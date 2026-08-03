import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Bot,
  Composer,
  Context,
  GrammyError,
  InlineKeyboard,
  NextFunction,
} from 'grammy';
import { BOT } from '../telegram/telegram.constants';
import { I18nService } from '../i18n/i18n.service';
import { Translations } from '../i18n/types/translations.interface';
import { UsersService } from '../users/users.service';
import { LocationResult, LocationService } from '../location/location.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { notSubscribedKeyboard } from '../registration/keyboards/registration.keyboard';

const DAILY_GOAL_STEPS = 10_000;
const REFERRAL_BONUS_PER_USER = 10;
const MEDALS = ['🥇', '🥈', '🥉'];
const PAGE_SIZE = 20;

@Injectable()
export class MainMenuUpdate implements OnModuleInit {
  private readonly logger = new Logger(MainMenuUpdate.name);

  constructor(
    @Inject(BOT) private readonly bot: Bot,
    private readonly locationService: LocationService,
    private readonly usersService: UsersService,
    private readonly subscriptionService: SubscriptionService,
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
  ) {}

  onModuleInit(): void {
    const composer = new Composer<Context>();

    composer.use((ctx, next) => this.requireSubscription(ctx, next));

    composer.on(['message:location', 'edited_message:location'], (ctx) =>
      this.onLocation(ctx),
    );
    composer.hears(
      this.i18n.allVariants((t) => t.mainMenu.locationBtn),
      (ctx) => this.onLocationButton(ctx),
    );
    composer.hears(
      this.i18n.allVariants((t) => t.mainMenu.balanceBtn),
      (ctx) => this.onBalance(ctx),
    );
    composer.hears(
      this.i18n.allVariants((t) => t.mainMenu.ratingBtn),
      (ctx) => this.onRating(ctx),
    );
    composer.hears(
      this.i18n.allVariants((t) => t.mainMenu.referralBtn),
      (ctx) => this.onReferral(ctx),
    );
    composer.callbackQuery(/^leaderboard:page:(\d+)$/, (ctx) =>
      this.onLeaderboardPage(ctx),
    );

    this.bot.use(composer);
    this.logger.log('Main menu handlers registered');
  }

  // ─── Subscription guard ──────────────────────────────────────────────────────

  private async requireSubscription(
    ctx: Context,
    next: NextFunction,
  ): Promise<void> {
    if (!ctx.from) return next();
    const user = await this.usersService.findByTelegramId(BigInt(ctx.from.id));
    if (!user?.registrationCompleted) return next();

    const subscribed = await this.subscriptionService.isSubscribed(ctx.from.id);
    if (!subscribed) {
      const t = this.i18n.t(user.language);
      try {
        await ctx.reply(t.registration.notSubscribed, {
          reply_markup: notSubscribedKeyboard(
            t,
            this.subscriptionService.getChannelLink(),
          ),
        });
      } catch (err) {
        this.logger.warn(
          `[main-menu] requireSubscription reply failed: ${err instanceof GrammyError ? err.description : String(err)}`,
        );
      }
      return;
    }
    return next();
  }

  // ─── Location button ─────────────────────────────────────────────────────────

  private async onLocationButton(ctx: Context): Promise<void> {
    const user = await this.usersService.findByTelegramId(BigInt(ctx.from!.id));
    const t = this.i18n.t(user?.language);
    await this.safeReply(ctx, t.mainMenu.locationInstruction, {
      parse_mode: 'Markdown',
    });
  }

  // ─── Live location updates ───────────────────────────────────────────────────

  private async onLocation(ctx: Context): Promise<void> {
    const location = ctx.msg!.location!;
    const telegramId = BigInt(ctx.from!.id);

    if (ctx.message && !location.live_period) {
      const user = await this.usersService.findByTelegramId(telegramId);
      const t = this.i18n.t(user?.language);
      await this.safeReply(ctx, t.mainMenu.staticLocationWarning, {
        parse_mode: 'Markdown',
      });
      return;
    }

    // ctx.message is set only on the initial live location share, not on auto-updates.
    const isNewSession = !!ctx.message;
    const { latitude, longitude, horizontal_accuracy } = location;

    const [user, result] = await Promise.all([
      this.usersService.findByTelegramId(telegramId),
      this.locationService.processLocationByTelegramId(
        telegramId,
        latitude,
        longitude,
        horizontal_accuracy,
      ),
    ]);

    const t = this.i18n.t(user?.language);

    if (!result) {
      await this.safeReply(ctx, t.mainMenu.userNotFound);
      return;
    }

    if (result.isFirstLocation) {
      await this.safeReply(ctx, t.mainMenu.trackingStarted, {
        parse_mode: 'Markdown',
      });
      return;
    }

    if (isNewSession) {
      if (result.filterReason === 'too_fast' && result.shouldWarnSpeed) {
        await this.safeReply(
          ctx,
          t.mainMenu.speedTooFastWarning(result.speedKmh!.toFixed(1)),
          { parse_mode: 'Markdown' },
        );
      }
      // Always acknowledge a new session with current progress, even when this
      // particular update was filtered (user restarted from the same spot, or
      // the fix had poor accuracy).
      let displayResult: LocationResult | null = result.wasFiltered
        ? null
        : result;
      if (!displayResult) {
        const progress = await this.locationService.getTodayProgress(user!.id);
        if (!progress) {
          // No accumulated progress yet despite having a prior location row —
          // treat identically to a first-of-day start.
          await this.safeReply(ctx, t.mainMenu.trackingStarted, {
            parse_mode: 'Markdown',
          });
          return;
        }
        displayResult = {
          isFirstLocation: false,
          wasFiltered: false,
          totalSteps: progress.totalSteps,
          totalMeters: progress.totalMeters,
          remainingSteps: Math.max(0, DAILY_GOAL_STEPS - progress.totalSteps),
          goalJustReached: false,
          alreadyReachedGoal: progress.goalReached,
          shouldNotify: true,
        };
      }
      await this.safeReply(ctx, this.buildLocationReply(displayResult, t), {
        parse_mode: 'Markdown',
      });
      return;
    }

    // Automatic updates: silent unless the 15-minute throttle allows.
    if (result.wasFiltered) {
      if (result.filterReason === 'too_fast' && result.shouldWarnSpeed) {
        await this.safeReply(
          ctx,
          t.mainMenu.speedTooFastWarning(result.speedKmh!.toFixed(1)),
          { parse_mode: 'Markdown' },
        );
      }
      return;
    }
    if (result.shouldNotify) {
      await this.safeReply(ctx, this.buildLocationReply(result, t), {
        parse_mode: 'Markdown',
      });
    }
  }

  private buildLocationReply(r: LocationResult, t: Translations): string {
    const km = (r.totalMeters / 1000).toFixed(2);
    const goalStr = DAILY_GOAL_STEPS.toLocaleString();
    const stepsStr = r.totalSteps.toLocaleString();
    const remainStr = r.remainingSteps.toLocaleString();
    const m = t.mainMenu;
    const done = r.goalJustReached || r.alreadyReachedGoal;
    const status = done ? m.progressStatusDone : m.progressStatusInProgress;

    const stats =
      `${m.progressSteps} ${stepsStr} / ${goalStr}\n` +
      `${m.progressDistance} ${km} km\n` +
      `${m.progressRemaining} ${remainStr} ${m.progressStepsUnit}\n` +
      status;

    if (r.goalJustReached) {
      return m.progressGoalJustReached(stats);
    }
    if (r.alreadyReachedGoal) {
      return m.progressAlreadyDone(stats);
    }
    return m.progressUpdated(stats);
  }

  // ─── Balance ─────────────────────────────────────────────────────────────────

  private async onBalance(ctx: Context): Promise<void> {
    const telegramId = BigInt(ctx.from!.id);
    const user = await this.usersService.findByTelegramId(telegramId);
    const t = this.i18n.t(user?.language);

    if (!user) {
      await this.safeReply(ctx, t.mainMenu.userNotFound);
      return;
    }

    const [rank, todayProgress] = await Promise.all([
      this.usersService.getUserRank(user.id),
      this.locationService.getTodayProgress(user.id),
    ]);

    const m = t.mainMenu;
    let text =
      `${m.balanceTitle}\n\n` +
      `${m.balanceTotalPoints(user.points.toLocaleString())}\n` +
      `${m.balanceRankLabel(rank)}\n\n` +
      `${m.balanceTodayTitle}\n`;

    if (todayProgress) {
      const km = (todayProgress.totalMeters / 1000).toFixed(2);
      text += `${m.balanceTodaySteps(todayProgress.totalSteps.toLocaleString(), DAILY_GOAL_STEPS.toLocaleString())}\n`;
      text += m.balanceTodayDist(km);
      if (todayProgress.goalReached) {
        text += `\n${m.balanceTodayGoalDone}`;
      }
    } else {
      text += m.balanceNoLocation;
    }

    await this.safeReply(ctx, text, { parse_mode: 'Markdown' });
  }

  // ─── Leaderboard ─────────────────────────────────────────────────────────────

  private async onRating(ctx: Context): Promise<void> {
    const telegramId = BigInt(ctx.from!.id);
    const user = await this.usersService.findByTelegramId(telegramId);
    const t = this.i18n.t(user?.language);

    if (!user) {
      await this.safeReply(ctx, t.mainMenu.userNotFound);
      return;
    }

    const { text, keyboard } = await this.fetchLeaderboardPage(
      user.id,
      user.points,
      1,
      t,
    );
    await this.safeReply(ctx, text, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  private async onLeaderboardPage(ctx: Context): Promise<void> {
    try {
      await ctx.answerCallbackQuery();
    } catch {
      /* ignore */
    }

    const [, pageStr] = ctx.match as RegExpMatchArray;
    const page = Math.max(1, parseInt(pageStr, 10));
    const telegramId = BigInt(ctx.from!.id);
    const user = await this.usersService.findByTelegramId(telegramId);
    if (!user) return;

    const t = this.i18n.t(user.language);
    const { text, keyboard } = await this.fetchLeaderboardPage(
      user.id,
      user.points,
      page,
      t,
    );

    try {
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } catch (err) {
      const isNotModified =
        err instanceof GrammyError &&
        err.description.includes('message is not modified');
      if (!isNotModified) {
        this.logger.warn(
          `[main-menu] editMessageText failed: ${err instanceof GrammyError ? err.description : String(err)}`,
        );
      }
    }
  }

  private async fetchLeaderboardPage(
    userId: number,
    userPoints: number,
    page: number,
    t: Translations,
  ): Promise<{ text: string; keyboard: InlineKeyboard }> {
    const skip = (page - 1) * PAGE_SIZE;
    const [leaderboard, rank] = await Promise.all([
      this.usersService.getLeaderboard(PAGE_SIZE, skip),
      this.usersService.getUserRank(userId),
    ]);

    const m = t.mainMenu;
    let text = `${m.ratingTitle}\n\n`;

    if (leaderboard.length === 0) {
      text += `${m.ratingEmpty}\n`;
    } else {
      for (let i = 0; i < leaderboard.length; i++) {
        const entry = leaderboard[i];
        const absoluteIndex = skip + i;
        const prefix = MEDALS[absoluteIndex] ?? `${absoluteIndex + 1}.`;
        const name = entry.firstName || entry.telegramUsername || m.ratingAnon;
        const isMe = entry.id === userId;
        const pts = entry.points.toLocaleString();
        text += `${prefix} ${isMe ? '👤 ' : ''}${name} — ${pts} ${t.common.points}\n`;
      }
    }

    text += '\n─────────────────\n';
    text += m.ratingMyRank(rank, userPoints.toLocaleString());

    const keyboard = new InlineKeyboard();
    if (page > 1) {
      keyboard.text('⬅️ Orqaga', `leaderboard:page:${page - 1}`);
    }
    if (leaderboard.length === PAGE_SIZE) {
      keyboard.text('➡️ Oldinga', `leaderboard:page:${page + 1}`);
    }

    return { text, keyboard };
  }

  // ─── Referral ─────────────────────────────────────────────────────────────────

  private async onReferral(ctx: Context): Promise<void> {
    const telegramId = BigInt(ctx.from!.id);
    const user = await this.usersService.findByTelegramId(telegramId);
    const t = this.i18n.t(user?.language);

    if (!user) {
      await this.safeReply(ctx, t.mainMenu.userNotFound);
      return;
    }

    const [referralCount, rawBotUsername] = await Promise.all([
      this.usersService.getCompletedReferralCount(user.id),
      Promise.resolve(this.configService.get<string>('BOT_USERNAME', '')),
    ]);

    const botUsername = rawBotUsername.trim().replace(/^@/, '');
    this.logger.debug(`[referral] BOT_USERNAME="${botUsername}"`);

    const referralLink = botUsername
      ? `https://t.me/${botUsername}?start=${user.telegramId.toString()}`
      : t.mainMenu.referralNoBotUsername;
    this.logger.debug(`[referral] link="${referralLink}"`);

    const totalReferralPoints = referralCount * REFERRAL_BONUS_PER_USER;
    const m = t.mainMenu;

    // HTML parse mode: Markdown v1 treats underscores in bot usernames as italic.
    const text =
      `👥 <b>${m.referralTitle}</b>\n\n` +
      `${m.referralLinkLabel}\n${referralLink}\n\n` +
      `${m.referralFriendsLabel(referralCount)}\n` +
      `${m.referralPointsLabel(totalReferralPoints)}\n\n` +
      m.referralBonusNote(REFERRAL_BONUS_PER_USER);

    await this.safeReply(ctx, text, { parse_mode: 'HTML' });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async safeReply(
    ctx: Context,
    text: string,
    other?: Parameters<Context['reply']>[1],
  ): Promise<void> {
    try {
      await ctx.reply(text, other);
    } catch (err) {
      this.logger.warn(
        `[main-menu] ctx.reply failed: ${err instanceof GrammyError ? err.description : String(err)}`,
      );
    }
  }
}
