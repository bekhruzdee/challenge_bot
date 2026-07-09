import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, Composer, Context } from 'grammy';
import { BOT } from '../telegram/telegram.constants';
import { I18nService } from '../i18n/i18n.service';
import { Translations } from '../i18n/types/translations.interface';
import { LeaderboardEntry, UsersService } from '../users/users.service';
import { LocationResult, LocationService } from '../location/location.service';

const DAILY_GOAL_STEPS = 10_000;
const REFERRAL_BONUS_PER_USER = 15;
const MEDALS = ['🥇', '🥈', '🥉'];

@Injectable()
export class MainMenuUpdate implements OnModuleInit {
  private readonly logger = new Logger(MainMenuUpdate.name);

  constructor(
    @Inject(BOT) private readonly bot: Bot,
    private readonly locationService: LocationService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
  ) {}

  onModuleInit(): void {
    const composer = new Composer<Context>();

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

    this.bot.use(composer);
    this.logger.log('Main menu handlers registered');
  }

  // ─── Location button ─────────────────────────────────────────────────────────

  private async onLocationButton(ctx: Context): Promise<void> {
    const user = await this.usersService.findByTelegramId(
      BigInt(ctx.from!.id),
    );
    const t = this.i18n.t(user?.language);
    await ctx.reply(t.mainMenu.locationInstruction, {
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
      await ctx.reply(t.mainMenu.staticLocationWarning, {
        parse_mode: 'Markdown',
      });
      return;
    }

    const { latitude, longitude } = location;

    const [user, result] = await Promise.all([
      this.usersService.findByTelegramId(telegramId),
      this.locationService.processLocationByTelegramId(
        telegramId,
        latitude,
        longitude,
      ),
    ]);

    const t = this.i18n.t(user?.language);

    if (!result) {
      await ctx.reply(t.mainMenu.userNotFound);
      return;
    }

    if (result.wasFiltered) return;

    if (result.isFirstLocation) {
      await ctx.reply(t.mainMenu.trackingStarted, { parse_mode: 'Markdown' });
      return;
    }

    await ctx.reply(this.buildLocationReply(result, t), {
      parse_mode: 'Markdown',
    });
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
    const delta = r.addedSteps > 0 ? m.progressDelta(r.addedSteps) : '';
    return m.progressUpdated(delta, stats);
  }

  // ─── Balance ─────────────────────────────────────────────────────────────────

  private async onBalance(ctx: Context): Promise<void> {
    const telegramId = BigInt(ctx.from!.id);
    const user = await this.usersService.findByTelegramId(telegramId);
    const t = this.i18n.t(user?.language);

    if (!user) {
      await ctx.reply(t.mainMenu.userNotFound);
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

    await ctx.reply(text, { parse_mode: 'Markdown' });
  }

  // ─── Leaderboard ─────────────────────────────────────────────────────────────

  private async onRating(ctx: Context): Promise<void> {
    const telegramId = BigInt(ctx.from!.id);
    const user = await this.usersService.findByTelegramId(telegramId);
    const t = this.i18n.t(user?.language);

    if (!user) {
      await ctx.reply(t.mainMenu.userNotFound);
      return;
    }

    const [leaderboard, rank] = await Promise.all([
      this.usersService.getLeaderboard(10),
      this.usersService.getUserRank(user.id),
    ]);

    await ctx.reply(
      this.buildLeaderboard(leaderboard, user.id, rank, user.points, t),
      { parse_mode: 'Markdown' },
    );
  }

  private buildLeaderboard(
    entries: LeaderboardEntry[],
    currentUserId: number,
    currentRank: number,
    currentPoints: number,
    t: Translations,
  ): string {
    const m = t.mainMenu;
    let text = `${m.ratingTitle}\n\n`;

    if (entries.length === 0) {
      text += `${m.ratingEmpty}\n`;
    } else {
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const prefix = MEDALS[i] ?? `${i + 1}.`;
        const name = entry.firstName || entry.telegramUsername || m.ratingAnon;
        const isMe = entry.id === currentUserId;
        const pts = entry.points.toLocaleString();
        text += `${prefix} ${isMe ? '👤 ' : ''}${name} — ${pts} ${t.common.points}\n`;
      }
    }

    const inTop10 = entries.some((e) => e.id === currentUserId);
    if (!inTop10) {
      text += '\n─────────────────\n';
      text += m.ratingMyRank(currentRank, currentPoints.toLocaleString());
    }

    return text;
  }

  // ─── Referral ─────────────────────────────────────────────────────────────────

  private async onReferral(ctx: Context): Promise<void> {
    const telegramId = BigInt(ctx.from!.id);
    const user = await this.usersService.findByTelegramId(telegramId);
    const t = this.i18n.t(user?.language);

    if (!user) {
      await ctx.reply(t.mainMenu.userNotFound);
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

    await ctx.reply(text, { parse_mode: 'HTML' });
  }
}
