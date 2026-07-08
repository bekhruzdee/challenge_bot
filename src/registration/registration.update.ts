import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RegistrationStep } from '@prisma/client';
import { Bot, Composer, Context, NextFunction } from 'grammy';
import { BOT } from '../telegram/telegram.constants';
import { mainMenuKeyboard } from '../main-menu/keyboards/main-menu.keyboard';
import { RegistrationData } from './interfaces/registration-data.interface';
import {
  contactKeyboard,
  notSubscribedKeyboard,
  regionKeyboard,
  rulesKeyboard,
} from './keyboards/registration.keyboard';
import { REGIONS, RULES_TEXT } from './registration.constants';
import { RegistrationService } from './registration.service';

@Injectable()
export class RegistrationUpdate implements OnModuleInit {
  private readonly logger = new Logger(RegistrationUpdate.name);

  constructor(
    @Inject(BOT) private readonly bot: Bot,
    private readonly registrationService: RegistrationService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    const composer = new Composer<Context>();

    composer.command('start', (ctx) => this.onStart(ctx));
    composer.callbackQuery('reg:start', (ctx) => this.onStartButton(ctx));
    composer.callbackQuery('reg:check_sub', (ctx) => this.onCheckSubscription(ctx));
    composer.on('message:contact', (ctx) => this.onContact(ctx));
    // Pass `next` so registered users fall through to MainMenuUpdate handlers.
    composer.on('message:text', (ctx, next) => this.onText(ctx, next));

    this.bot.use(composer);
    this.logger.log('Registration handlers registered');
  }

  // ─── /start ─────────────────────────────────────────────────────────────────

  private async onStart(ctx: Context): Promise<void> {
    const from = ctx.from!;

    const user = await this.registrationService.getOrCreateUser(
      BigInt(from.id),
      from.username,
      from.first_name,
      from.last_name,
    );

    if (user.registrationCompleted) {
      await this.showMainMenu(ctx);
      return;
    }

    await this.registrationService.upsertSession(user.id, RegistrationStep.RULES, {});
    await ctx.reply(RULES_TEXT, {
      parse_mode: 'Markdown',
      reply_markup: rulesKeyboard(),
    });
  }

  // ─── Inline button: "Boshlash" ───────────────────────────────────────────────

  private async onStartButton(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();

    const user = await this.registrationService.getUserByTelegramId(BigInt(ctx.from!.id));
    if (!user) return;

    await this.handleSubscriptionCheck(ctx, user.id);
  }

  // ─── Inline button: "Obuna bo'ldim" ─────────────────────────────────────────

  private async onCheckSubscription(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery({ text: 'Tekshirilmoqda...' });

    const user = await this.registrationService.getUserByTelegramId(BigInt(ctx.from!.id));
    if (!user) return;

    await this.handleSubscriptionCheck(ctx, user.id);
  }

  // ─── Subscription gate ───────────────────────────────────────────────────────

  private async handleSubscriptionCheck(ctx: Context, userId: number): Promise<void> {
    const subscribed = await this.isSubscribed(ctx.from!.id);

    if (!subscribed) {
      const channelLink = this.resolveChannelLink();
      await ctx.reply(
        "❌ Siz hali kanalga obuna bo'lmadingiz.\n\nIltimos, obuna bo'ling va «Obuna bo'ldim» tugmasini bosing.",
        { reply_markup: notSubscribedKeyboard(channelLink) },
      );
      await this.registrationService.upsertSession(userId, RegistrationStep.CHECKING_SUB, {});
      return;
    }

    try {
      await ctx.editMessageReplyMarkup();
    } catch {
      // Message too old or already edited — safe to ignore.
    }

    await this.registrationService.upsertSession(userId, RegistrationStep.ASK_FIRST_NAME, {});
    await ctx.reply('👤 Ismingizni kiriting:');
  }

  // ─── Text messages (FSM dispatch) ───────────────────────────────────────────

  private async onText(ctx: Context, next: NextFunction): Promise<void> {
    const user = await this.registrationService.getUserByTelegramId(BigInt(ctx.from!.id));

    // Registered users (or unknown users) fall through to MainMenuUpdate.
    if (!user || user.registrationCompleted) {
      return next();
    }

    const session = await this.registrationService.getSession(user.id);
    if (!session) return next();

    const text = ctx.msg!.text!.trim();
    const saved = session.data as unknown as Partial<RegistrationData>;

    switch (session.step) {
      case RegistrationStep.RULES:
      case RegistrationStep.CHECKING_SUB:
        // No free-text expected at these steps — silently ignore.
        break;

      case RegistrationStep.ASK_FIRST_NAME:
        await this.registrationService.upsertSession(user.id, RegistrationStep.ASK_LAST_NAME, {
          firstName: text,
        });
        await ctx.reply('👤 Familiyangizni kiriting:');
        break;

      case RegistrationStep.ASK_LAST_NAME:
        await this.registrationService.upsertSession(user.id, RegistrationStep.ASK_PHONE, {
          ...saved,
          lastName: text,
        });
        await ctx.reply('📱 Telefon raqamingizni yuboring:', {
          reply_markup: contactKeyboard(),
        });
        break;

      case RegistrationStep.ASK_PHONE:
        await ctx.reply("⚠️ Iltimos, «Telefon raqamni yuborish» tugmasini bosing.", {
          reply_markup: contactKeyboard(),
        });
        break;

      case RegistrationStep.ASK_REGION:
        if (!REGIONS.includes(text)) {
          await ctx.reply('⚠️ Iltimos, quyidagi viloyatlardan birini tanlang:', {
            reply_markup: regionKeyboard(),
          });
          return;
        }
        await this.finishRegistration(ctx, user.id, saved as RegistrationData, text);
        break;
    }
  }

  // ─── Contact share ───────────────────────────────────────────────────────────

  private async onContact(ctx: Context): Promise<void> {
    const user = await this.registrationService.getUserByTelegramId(BigInt(ctx.from!.id));
    if (!user) return;

    const session = await this.registrationService.getSession(user.id);
    if (!session || session.step !== RegistrationStep.ASK_PHONE) return;

    const contact = ctx.msg!.contact!;
    if (contact.user_id !== ctx.from!.id) {
      await ctx.reply("⚠️ Iltimos, o'z telefon raqamingizni yuboring.", {
        reply_markup: contactKeyboard(),
      });
      return;
    }

    const saved = session.data as unknown as Partial<RegistrationData>;
    await this.registrationService.upsertSession(user.id, RegistrationStep.ASK_REGION, {
      ...saved,
      phone: contact.phone_number,
    });
    await ctx.reply('📍 Viloyatingizni tanlang:', { reply_markup: regionKeyboard() });
  }

  // ─── Complete registration ───────────────────────────────────────────────────

  private async finishRegistration(
    ctx: Context,
    userId: number,
    data: RegistrationData,
    region: string,
  ): Promise<void> {
    await this.registrationService.completeRegistration(userId, data, region);
    await this.showMainMenu(ctx);
  }

  // ─── Main menu ───────────────────────────────────────────────────────────────

  private async showMainMenu(ctx: Context): Promise<void> {
    await ctx.reply("🎉 Ro'yxatdan muvaffaqiyatli o'tdingiz!\n\n📋 Asosiy menyu:", {
      reply_markup: mainMenuKeyboard(),
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async isSubscribed(telegramUserId: number): Promise<boolean> {
    const channelId = this.configService.get<string>('CHANNEL_ID');
    if (!channelId) return true;

    try {
      const member = await this.bot.api.getChatMember(channelId, telegramUserId);
      return ['creator', 'administrator', 'member'].includes(member.status);
    } catch {
      this.logger.warn(`Subscription check failed for user ${telegramUserId}`);
      return false;
    }
  }

  private resolveChannelLink(): string {
    const channelId = this.configService.get<string>('CHANNEL_ID', '');
    return channelId.startsWith('@')
      ? `https://t.me/${channelId.slice(1)}`
      : `https://t.me/c/${Math.abs(Number(channelId))}`;
  }
}
