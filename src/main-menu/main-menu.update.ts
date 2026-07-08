import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Bot, Composer, Context } from 'grammy';
import { BOT } from '../telegram/telegram.constants';
import { LocationResult, LocationService } from '../location/location.service';
import { MAIN_MENU } from './main-menu.constants';

const DAILY_GOAL_STEPS = 10_000;

@Injectable()
export class MainMenuUpdate implements OnModuleInit {
  private readonly logger = new Logger(MainMenuUpdate.name);

  constructor(
    @Inject(BOT) private readonly bot: Bot,
    private readonly locationService: LocationService,
  ) {}

  onModuleInit(): void {
    const composer = new Composer<Context>();

    // Handle both the initial location share and every live-location update.
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

    await ctx.reply(this.buildLocationReply(result), { parse_mode: 'Markdown' });
  }

  private buildLocationReply(r: LocationResult): string {
    const pct = Math.min(100, Math.floor((r.totalSteps / DAILY_GOAL_STEPS) * 100));
    const km = (r.totalMeters / 1000).toFixed(2);
    const stepsStr = `${r.totalSteps.toLocaleString()} / ${DAILY_GOAL_STEPS.toLocaleString()}`;

    const stats =
      `🚶 *Qadamlar:* ${stepsStr}\n` +
      `📏 *Masofa:* ${km} km\n` +
      `🏁 *Bajarildi:* ${pct}%`;

    if (r.isFirstLocation) {
      return `📍 *Boshlang'ich nuqta saqlandi!*\n\nHar safar joylashuvingizni yuboring — qadamlar hisoblanadi.\n\n${stats}`;
    }

    if (r.goalJustReached) {
      return (
        `🎉 *Tabriklaymiz! Kunlik maqsadga etdingiz!*\n\n${stats}\n\n` +
        `🏆 *+100 ball oldiniz!*`
      );
    }

    if (r.alreadyReachedGoal) {
      return `✅ *Maqsad allaqachon bajarilgan!*\n\n${stats}`;
    }

    const delta = r.addedSteps > 0 ? `  *(+${r.addedSteps} qadam)*` : '';
    return `📍 *Lokatsiya yangilandi*${delta}\n\n${stats}`;
  }

  // ─── Other menu buttons (placeholders until features are built) ──────────────

  private async onBalance(ctx: Context): Promise<void> {
    await ctx.reply(
      "💰 Sizning balansingiz: *0 ball*\n\nBall to'plash funksiyasi tez orada ishga tushadi.",
      { parse_mode: 'Markdown' },
    );
  }

  private async onRating(ctx: Context): Promise<void> {
    await ctx.reply('🏆 Reyting tez orada ishga tushadi!');
  }

  private async onReferral(ctx: Context): Promise<void> {
    await ctx.reply("👥 Do'stlarni taklif qilish funksiyasi tez orada bo'ladi!");
  }
}
