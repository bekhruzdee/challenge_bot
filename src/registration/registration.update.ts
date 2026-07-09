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

  private readonly adminIds: Set<bigint>;

  constructor(
    @Inject(BOT) private readonly bot: Bot,
    private readonly registrationService: RegistrationService,
    private readonly configService: ConfigService,
  ) {
    const raw = this.configService.get<string>('ADMIN_IDS', '');
    this.adminIds = new Set(
      raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map(BigInt),
    );
  }

  onModuleInit(): void {
    const composer = new Composer<Context>();

    composer.command('start', (ctx) => this.onStart(ctx));
    composer.callbackQuery('reg:start', (ctx) => this.onStartButton(ctx));
    composer.callbackQuery('reg:check_sub', (ctx) =>
      this.onCheckSubscription(ctx),
    );
    composer.on('message:contact', (ctx) => this.onContact(ctx));
    // Pass `next` so registered users fall through to MainMenuUpdate handlers.
    composer.on('message:text', (ctx, next) => this.onText(ctx, next));

    this.bot.use(composer);
    this.logger.log('Registration handlers registered');
  }

  // ─── /start ─────────────────────────────────────────────────────────────────

  private async onStart(ctx: Context): Promise<void> {
    const from = ctx.from!;

    // ctx.match holds the deep-link payload: "/start <payload>" → "<payload>"
    const payload = typeof ctx.match === 'string' ? ctx.match.trim() : '';
    const referrerId = await this.resolveReferrerId(payload, from.id);

    const user = await this.registrationService.getOrCreateUser(
      BigInt(from.id),
      from.username,
      from.first_name,
      from.last_name,
      referrerId,
    );

    if (user.registrationCompleted) {
      await this.showMainMenu(ctx);
      return;
    }

    await this.registrationService.upsertSession(
      user.id,
      RegistrationStep.RULES,
      {},
    );
    await ctx.reply(RULES_TEXT, {
      parse_mode: 'Markdown',
      reply_markup: rulesKeyboard(),
    });
  }

  /**
   * Resolves a referral deep-link payload to an internal user id.
   * The payload is the referrer's Telegram user id (e.g. "/start 123456789").
   * Returns undefined for self-referrals, unknown users, or invalid payloads.
   */
  private async resolveReferrerId(
    payload: string,
    currentTelegramId: number,
  ): Promise<number | undefined> {
    if (!payload || !/^\d+$/.test(payload)) return undefined;

    const refTelegramId = BigInt(payload);
    if (refTelegramId === BigInt(currentTelegramId)) return undefined;

    const referrer =
      await this.registrationService.getUserByTelegramId(refTelegramId);
    return referrer?.registrationCompleted ? referrer.id : undefined;
  }

  // ─── Inline button: "Boshlash" ───────────────────────────────────────────────

  private async onStartButton(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();

    const user = await this.registrationService.getUserByTelegramId(
      BigInt(ctx.from!.id),
    );
    if (!user) return;

    await this.handleSubscriptionCheck(ctx, user.id);
  }

  // ─── Inline button: "Obuna bo'ldim" ─────────────────────────────────────────

  private async onCheckSubscription(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery({ text: 'Tekshirilmoqda...' });

    const user = await this.registrationService.getUserByTelegramId(
      BigInt(ctx.from!.id),
    );
    if (!user) return;

    await this.handleSubscriptionCheck(ctx, user.id);
  }

  // ─── Subscription gate ───────────────────────────────────────────────────────

  private async handleSubscriptionCheck(
    ctx: Context,
    userId: number,
  ): Promise<void> {
    const subscribed = await this.isSubscribed(ctx.from!.id);

    if (!subscribed) {
      const channelLink = this.resolveChannelLink();
      const text =
        "❌ Siz hali kanalga obuna bo'lmadingiz.\n\n" +
        "Kanalga o'tib, obuna bo'ling va «Tekshirish ✅» tugmasini bosing.";
      try {
        // Edit the message that triggered this callback so the chat stays clean.
        await ctx.editMessageText(text, {
          reply_markup: notSubscribedKeyboard(channelLink),
        });
      } catch {
        // Editing failed (message too old, context mismatch) — send a new one.
        await ctx.reply(text, {
          reply_markup: notSubscribedKeyboard(channelLink),
        });
      }
      await this.registrationService.upsertSession(
        userId,
        RegistrationStep.CHECKING_SUB,
        {},
      );
      return;
    }

    try {
      await ctx.editMessageReplyMarkup();
    } catch {
      // Message too old or already edited — safe to ignore.
    }

    await this.registrationService.upsertSession(
      userId,
      RegistrationStep.ASK_FIRST_NAME,
      {},
    );
    await ctx.reply('👤 Ismingizni kiriting:');
  }

  // ─── Text messages (FSM dispatch) ───────────────────────────────────────────

  private async onText(ctx: Context, next: NextFunction): Promise<void> {
    const user = await this.registrationService.getUserByTelegramId(
      BigInt(ctx.from!.id),
    );

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
        await this.registrationService.upsertSession(
          user.id,
          RegistrationStep.ASK_LAST_NAME,
          {
            firstName: text,
          },
        );
        await ctx.reply('👤 Familiyangizni kiriting:');
        break;

      case RegistrationStep.ASK_LAST_NAME:
        await this.registrationService.upsertSession(
          user.id,
          RegistrationStep.ASK_PHONE,
          {
            ...saved,
            lastName: text,
          },
        );
        await ctx.reply('📱 Telefon raqamingizni yuboring:', {
          reply_markup: contactKeyboard(),
        });
        break;

      case RegistrationStep.ASK_PHONE:
        await ctx.reply(
          '⚠️ Iltimos, «Telefon raqamni yuborish» tugmasini bosing.',
          {
            reply_markup: contactKeyboard(),
          },
        );
        break;

      case RegistrationStep.ASK_REGION:
        if (!REGIONS.includes(text)) {
          await ctx.reply(
            '⚠️ Iltimos, quyidagi viloyatlardan birini tanlang:',
            {
              reply_markup: regionKeyboard(),
            },
          );
          return;
        }
        await this.finishRegistration(
          ctx,
          user.id,
          saved as RegistrationData,
          text,
        );
        break;
    }
  }

  // ─── Contact share ───────────────────────────────────────────────────────────

  private async onContact(ctx: Context): Promise<void> {
    const user = await this.registrationService.getUserByTelegramId(
      BigInt(ctx.from!.id),
    );
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
    await this.registrationService.upsertSession(
      user.id,
      RegistrationStep.ASK_REGION,
      {
        ...saved,
        phone: contact.phone_number,
      },
    );
    await ctx.reply('📍 Viloyatingizni tanlang:', {
      reply_markup: regionKeyboard(),
    });
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
    const isAdmin = this.adminIds.has(BigInt(ctx.from!.id));
    await ctx.reply(
      "🎉 Ro'yxatdan muvaffaqiyatli o'tdingiz!\n\n📋 Asosiy menyu:",
      {
        reply_markup: mainMenuKeyboard(isAdmin),
      },
    );
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async isSubscribed(telegramUserId: number): Promise<boolean> {
    const raw = (this.configService.get<string>('CHANNEL_ID') ?? '').trim();
    if (!raw) {
      this.logger.warn('CHANNEL_ID is not set — subscription gate is disabled');
      return true;
    }

    const channelId = this.normaliseChannelId(raw);

    try {
      const member = await this.bot.api.getChatMember(
        channelId,
        telegramUserId,
      );
      this.logger.debug(
        `[sub] channel=${channelId} user=${telegramUserId} → ${member.status}`,
      );
      return ['creator', 'administrator', 'member'].includes(member.status);
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[sub] getChatMember failed — channel=${channelId} user=${telegramUserId}: ${detail}`,
      );
      return false;
    }
  }

  /**
   * Normalises the raw CHANNEL_ID env value into the form the Bot API accepts:
   *   "@username"      → pass through          (public channel)
   *   "-1001234567890" → pass through          (private channel/supergroup, already correct)
   *   "1001234567890"  → negated → -1001234567890  (positive ID, user forgot the minus)
   *   "channelname"    → "@channelname"        (bare username, no @ prefix)
   */
  private normaliseChannelId(raw: string): string | number {
    if (raw.startsWith('@')) return raw; // already @username
    if (raw.startsWith('-')) return raw; // already a negative numeric ID
    const n = parseInt(raw, 10);
    if (!isNaN(n)) return -n; // positive number → make it negative
    return `@${raw}`; // bare word → treat as username
  }

  private resolveChannelLink(): string {
    const link = this.configService.get<string>('CHANNEL_LINK', '').trim();
    if (!link) {
      this.logger.warn(
        'CHANNEL_LINK is not set — channel button will have an empty URL',
      );
    }
    return link;
  }
}
