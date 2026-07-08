import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, Composer, Context } from 'grammy';
import { BOT } from '../telegram/telegram.constants';
import { LeaderboardEntry, UsersService } from '../users/users.service';
import { LocationResult, LocationService } from '../location/location.service';
import { MAIN_MENU } from './main-menu.constants';

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
  ) {}

  onModuleInit(): void {
    const composer = new Composer<Context>();

    composer.on(['message:location', 'edited_message:location'], (ctx) =>
      this.onLocation(ctx),
    );
    composer.hears(MAIN_MENU.BALANCE, (ctx) => this.onBalance(ctx));
    composer.hears(MAIN_MENU.RATING, (ctx) => this.onRating(ctx));
    composer.hears(MAIN_MENU.REFERRAL, (ctx) => this.onReferral(ctx));

    this.bot.use(composer);
    this.logger.log('Main menu handlers registered');
  }

  // ─── Location ────────────────────────────────────────────────────────────────

  private async onLocation(ctx: Context): Promise<void> {
    const { latitude, longitude } = ctx.msg!.location!;
    const telegramId = BigInt(ctx.from!.id);

    const result = await this.locationService.processLocationByTelegramId(
      telegramId,
      latitude,
      longitude,
    );

    if (!result) {
      await ctx.reply("⚠️ Foydalanuvchi topilmadi. /start buyrug'ini bosing.");
      return;
    }

    if (result.wasFiltered) return;

    await ctx.reply(this.buildLocationReply(result), {
      parse_mode: 'Markdown',
    });
  }

  private buildLocationReply(r: LocationResult): string {
    const km = (r.totalMeters / 1000).toFixed(2);
    const goalStr = DAILY_GOAL_STEPS.toLocaleString();
    const stepsStr = r.totalSteps.toLocaleString();
    const remainStr = r.remainingSteps.toLocaleString();
    const done = r.goalJustReached || r.alreadyReachedGoal;
    const status = done ? '🔴 Maqsad bajarildi!' : '🟢 Jarayonda';

    const stats =
      `🚶 *Qadamlar:* ${stepsStr} / ${goalStr}\n` +
      `📏 *Masofa:* ${km} km\n` +
      `⏳ *Qolgan:* ${remainStr} qadam\n` +
      status;

    if (r.isFirstLocation) {
      return (
        `📍 *Boshlang'ich nuqta saqlandi!*\n\n` +
        `Har safar joylashuvingizni yuboring — qadamlar hisoblanadi.\n\n` +
        stats
      );
    }

    if (r.goalJustReached) {
      return `🎉 *Tabriklaymiz! Kunlik maqsad bajarildi!*\n\n${stats}\n\n🏆 *+100 ball oldiniz!*`;
    }

    if (r.alreadyReachedGoal) {
      return `✅ *Maqsad allaqachon bajarilgan!*\n\n${stats}`;
    }

    const delta = r.addedSteps > 0 ? ` *(+${r.addedSteps} qadam)*` : '';
    return `📍 *Lokatsiya yangilandi*${delta}\n\n${stats}`;
  }

  // ─── Balance ─────────────────────────────────────────────────────────────────

  private async onBalance(ctx: Context): Promise<void> {
    const telegramId = BigInt(ctx.from!.id);
    const user = await this.usersService.findByTelegramId(telegramId);
    if (!user) {
      await ctx.reply("⚠️ Foydalanuvchi topilmadi. /start buyrug'ini bosing.");
      return;
    }

    const [rank, todayProgress] = await Promise.all([
      this.usersService.getUserRank(user.id),
      this.locationService.getTodayProgress(user.id),
    ]);

    let text =
      `💰 *Mening balansim*\n\n` +
      `🏅 Umumiy ball: *${user.points.toLocaleString()}*\n` +
      `🏆 Reyting: *#${rank}*\n\n` +
      `📍 *Bugungi natija:*\n`;

    if (todayProgress) {
      const km = (todayProgress.totalMeters / 1000).toFixed(2);
      const steps = todayProgress.totalSteps.toLocaleString();
      text += `🚶 Qadamlar: ${steps} / ${DAILY_GOAL_STEPS.toLocaleString()}\n`;
      text += `📏 Masofa: ${km} km`;
      if (todayProgress.goalReached) {
        text += '\n✅ Maqsad bajarildi!';
      }
    } else {
      text += 'Hali lokatsiya yuborilmagan';
    }

    await ctx.reply(text, { parse_mode: 'Markdown' });
  }

  // ─── Leaderboard ─────────────────────────────────────────────────────────────

  private async onRating(ctx: Context): Promise<void> {
    const telegramId = BigInt(ctx.from!.id);
    const user = await this.usersService.findByTelegramId(telegramId);
    if (!user) {
      await ctx.reply("⚠️ Foydalanuvchi topilmadi. /start buyrug'ini bosing.");
      return;
    }

    const [leaderboard, rank] = await Promise.all([
      this.usersService.getLeaderboard(10),
      this.usersService.getUserRank(user.id),
    ]);

    await ctx.reply(
      this.buildLeaderboard(leaderboard, user.id, rank, user.points),
      { parse_mode: 'Markdown' },
    );
  }

  private buildLeaderboard(
    entries: LeaderboardEntry[],
    currentUserId: number,
    currentRank: number,
    currentPoints: number,
  ): string {
    let text = '🏆 *TOP-10 Reyting*\n\n';

    if (entries.length === 0) {
      text += "Hali hech kim ro'yxatda yo'q.\n";
    } else {
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const prefix = MEDALS[i] ?? `${i + 1}.`;
        const name =
          entry.firstName || entry.telegramUsername || 'Foydalanuvchi';
        const isMe = entry.id === currentUserId;
        const pts = entry.points.toLocaleString();
        text += `${prefix} ${isMe ? '👤 ' : ''}${name} — ${pts} ball\n`;
      }
    }

    const inTop10 = entries.some((e) => e.id === currentUserId);
    if (!inTop10) {
      text += '\n─────────────────\n';
      text += `📊 *Sizning o'rningiz:* #${currentRank} — ${currentPoints.toLocaleString()} ball`;
    }

    return text;
  }

  // ─── Referral ─────────────────────────────────────────────────────────────────

  private async onReferral(ctx: Context): Promise<void> {
    const telegramId = BigInt(ctx.from!.id);
    const user = await this.usersService.findByTelegramId(telegramId);
    if (!user) {
      await ctx.reply("⚠️ Foydalanuvchi topilmadi. /start buyrug'ini bosing.");
      return;
    }

    const [referralCount, rawBotUsername] = await Promise.all([
      this.usersService.getCompletedReferralCount(user.id),
      Promise.resolve(this.configService.get<string>('BOT_USERNAME', '')),
    ]);

    // Trim whitespace and strip an optional leading '@'; never alter the name further.
    const botUsername = rawBotUsername.trim().replace(/^@/, '');
    this.logger.debug(`[referral] BOT_USERNAME="${botUsername}"`);

    const referralLink = botUsername
      ? `https://t.me/${botUsername}?start=${user.telegramId.toString()}`
      : "(BOT_USERNAME .env faylida o'rnatilmagan)";
    this.logger.debug(`[referral] link="${referralLink}"`);

    const totalReferralPoints = referralCount * REFERRAL_BONUS_PER_USER;

    // HTML parse mode — Markdown v1 would treat underscores in the bot username
    // as italic markers and silently strip them from the rendered URL.
    const text =
      `👥 <b>Do'stlarni taklif qilish</b>\n\n` +
      `🔗 Sizning havolangiz:\n${referralLink}\n\n` +
      `👫 Taklif qilgan do'stlar: <b>${referralCount}</b>\n` +
      `💰 Referral ballari: <b>${totalReferralPoints} ball</b>\n\n` +
      `<i>Har bir ro'yxatdan o'tgan do'stingiz uchun +${REFERRAL_BONUS_PER_USER} ball!</i>`;

    await ctx.reply(text, { parse_mode: 'HTML' });
  }
}
