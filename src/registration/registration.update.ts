import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Language, RegistrationStep } from '@prisma/client';
import { Bot, Composer, Context, NextFunction } from 'grammy';
import { BOT } from '../telegram/telegram.constants';
import { I18nService } from '../i18n/i18n.service';
import { mainMenuKeyboard } from '../main-menu/keyboards/main-menu.keyboard';
import { RegistrationData } from './interfaces/registration-data.interface';
import {
  contactKeyboard,
  languageKeyboard,
  notSubscribedKeyboard,
  regionKeyboard,
  rulesKeyboard,
} from './keyboards/registration.keyboard';
import { RegistrationService } from './registration.service';
import { SubscriptionService } from '../subscription/subscription.service';

const LANG_SELECT_PROMPT = 'Tilni tanlang / Выберите язык:';

@Injectable()
export class RegistrationUpdate implements OnModuleInit {
  private readonly logger = new Logger(RegistrationUpdate.name);

  private readonly adminIds: Set<bigint>;

  constructor(
    @Inject(BOT) private readonly bot: Bot,
    private readonly registrationService: RegistrationService,
    private readonly subscriptionService: SubscriptionService,
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
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
    composer.hears(
      this.i18n.allVariants((t) => t.mainMenu.changeLangBtn),
      (ctx) => this.onChangeLang(ctx),
    );
    composer.callbackQuery(/^lang:(uz|ru)$/, (ctx) => this.onLangSelect(ctx));
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

    const payload = typeof ctx.match === 'string' ? ctx.match.trim() : '';
    const referrerId = await this.resolveReferrerId(payload, from.id);

    const user = await this.registrationService.getOrCreateUser(
      BigInt(from.id),
      from.username,
      from.first_name,
      from.last_name,
      referrerId,
    );

    if (!user.language) {
      await ctx.reply(LANG_SELECT_PROMPT, {
        reply_markup: languageKeyboard(),
      });
      return;
    }

    if (user.registrationCompleted) {
      await this.showMainMenu(ctx, user.language);
      return;
    }

    const t = this.i18n.t(user.language);
    await this.registrationService.upsertSession(
      user.id,
      RegistrationStep.RULES,
      {},
    );
    await ctx.reply(t.registration.rules, {
      parse_mode: 'Markdown',
      reply_markup: rulesKeyboard(t),
    });
  }

  // ─── "Change language" button ────────────────────────────────────────────────

  private async onChangeLang(ctx: Context): Promise<void> {
    await ctx.reply(LANG_SELECT_PROMPT, { reply_markup: languageKeyboard() });
  }

  // ─── Language selection callback ──────────────────────────────────────────────

  private async onLangSelect(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();

    const langStr = (ctx.match as RegExpMatchArray)[1] as Language;

    const user = await this.registrationService.getUserByTelegramId(
      BigInt(ctx.from!.id),
    );
    if (!user) return;

    await this.registrationService.setLanguage(user.id, langStr);

    try {
      await ctx.editMessageReplyMarkup();
    } catch {
      // Already removed or context mismatch — safe to ignore.
    }

    const t = this.i18n.t(langStr);

    if (user.registrationCompleted) {
      // Returning user changing language: confirm and redraw keyboard in new language.
      const isAdmin = this.adminIds.has(BigInt(ctx.from!.id));
      await ctx.reply(t.registration.langChanged, {
        reply_markup: mainMenuKeyboard(t, isAdmin),
      });
      return;
    }

    // New user: continue into the registration flow in the chosen language.
    await this.registrationService.upsertSession(
      user.id,
      RegistrationStep.RULES,
      {},
    );
    await ctx.reply(t.registration.rules, {
      parse_mode: 'Markdown',
      reply_markup: rulesKeyboard(t),
    });
  }

  // ─── Resolves referral deep-link ─────────────────────────────────────────────

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

  // ─── Inline button: "Boshlash / Начать" ─────────────────────────────────────

  private async onStartButton(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();

    const user = await this.registrationService.getUserByTelegramId(
      BigInt(ctx.from!.id),
    );
    if (!user) return;

    await this.handleSubscriptionCheck(ctx, user.id, user.language, user.registrationCompleted);
  }

  // ─── Inline button: check subscription ──────────────────────────────────────

  private async onCheckSubscription(ctx: Context): Promise<void> {
    const user = await this.registrationService.getUserByTelegramId(
      BigInt(ctx.from!.id),
    );
    const t = this.i18n.t(user?.language);
    await ctx.answerCallbackQuery({ text: t.registration.checkingAnswer });

    if (!user) return;
    await this.handleSubscriptionCheck(ctx, user.id, user.language, user.registrationCompleted);
  }

  // ─── Subscription gate ───────────────────────────────────────────────────────

  private async handleSubscriptionCheck(
    ctx: Context,
    userId: number,
    lang: Language | null,
    registrationCompleted: boolean,
  ): Promise<void> {
    const t = this.i18n.t(lang);
    const subscribed = await this.subscriptionService.isSubscribed(ctx.from!.id);

    if (!subscribed) {
      const channelLink = this.subscriptionService.getChannelLink();
      try {
        await ctx.editMessageText(t.registration.notSubscribed, {
          reply_markup: notSubscribedKeyboard(t, channelLink),
        });
      } catch {
        await ctx.reply(t.registration.notSubscribed, {
          reply_markup: notSubscribedKeyboard(t, channelLink),
        });
      }
      if (!registrationCompleted) {
        await this.registrationService.upsertSession(
          userId,
          RegistrationStep.CHECKING_SUB,
          {},
        );
      }
      return;
    }

    try {
      await ctx.editMessageReplyMarkup();
    } catch {
      // Already removed — safe to ignore.
    }

    if (registrationCompleted) {
      await this.showMainMenu(ctx, lang);
      return;
    }

    await this.registrationService.upsertSession(
      userId,
      RegistrationStep.ASK_FIRST_NAME,
      {},
    );
    await ctx.reply(t.registration.askFirstName);
  }

  // ─── Text messages (FSM dispatch) ───────────────────────────────────────────

  private async onText(ctx: Context, next: NextFunction): Promise<void> {
    const user = await this.registrationService.getUserByTelegramId(
      BigInt(ctx.from!.id),
    );

    if (!user || user.registrationCompleted) {
      return next();
    }

    const session = await this.registrationService.getSession(user.id);
    if (!session) return next();

    const text = ctx.msg!.text!.trim();
    const saved = session.data as unknown as Partial<RegistrationData>;
    const t = this.i18n.t(user.language);

    switch (session.step) {
      case RegistrationStep.RULES:
      case RegistrationStep.CHECKING_SUB:
        break;

      case RegistrationStep.ASK_FIRST_NAME:
        await this.registrationService.upsertSession(
          user.id,
          RegistrationStep.ASK_LAST_NAME,
          { firstName: text },
        );
        await ctx.reply(t.registration.askLastName);
        break;

      case RegistrationStep.ASK_LAST_NAME:
        await this.registrationService.upsertSession(
          user.id,
          RegistrationStep.ASK_PHONE,
          { ...saved, lastName: text },
        );
        await ctx.reply(t.registration.askPhone, {
          reply_markup: contactKeyboard(t),
        });
        break;

      case RegistrationStep.ASK_PHONE:
        await ctx.reply(t.registration.wrongPhoneBtn, {
          reply_markup: contactKeyboard(t),
        });
        break;

      case RegistrationStep.ASK_REGION: {
        const canonical = this.i18n.resolveRegion(text);
        if (!canonical) {
          await ctx.reply(t.registration.wrongRegion, {
            reply_markup: regionKeyboard(t),
          });
          return;
        }
        await this.finishRegistration(
          ctx,
          user.id,
          saved as RegistrationData,
          canonical,
          user.language,
        );
        break;
      }
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

    const t = this.i18n.t(user.language);
    const contact = ctx.msg!.contact!;
    if (contact.user_id !== ctx.from!.id) {
      await ctx.reply(t.registration.wrongPhone, {
        reply_markup: contactKeyboard(t),
      });
      return;
    }

    const saved = session.data as unknown as Partial<RegistrationData>;
    await this.registrationService.upsertSession(
      user.id,
      RegistrationStep.ASK_REGION,
      { ...saved, phone: contact.phone_number },
    );
    await ctx.reply(t.registration.askRegion, {
      reply_markup: regionKeyboard(t),
    });
  }

  // ─── Complete registration ───────────────────────────────────────────────────

  private async finishRegistration(
    ctx: Context,
    userId: number,
    data: RegistrationData,
    region: string,
    lang: Language | null,
  ): Promise<void> {
    await this.registrationService.completeRegistration(userId, data, region);
    await this.showMainMenu(ctx, lang);
  }

  // ─── Main menu ───────────────────────────────────────────────────────────────

  private async showMainMenu(
    ctx: Context,
    lang: Language | null,
  ): Promise<void> {
    const isAdmin = this.adminIds.has(BigInt(ctx.from!.id));
    const t = this.i18n.t(lang);
    await ctx.reply(t.registration.success, {
      reply_markup: mainMenuKeyboard(t, isAdmin),
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

}
