import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Bot, Composer, Context, GrammyError } from 'grammy';
import { BOT } from '../telegram/telegram.constants';
import { MAIN_MENU } from '../main-menu/main-menu.constants';
import { StoryService } from '../story/story.service';
import { AdminService } from './admin.service';
import { ADMIN_CB } from './admin.constants';
import {
  adminMenuKeyboard,
  backKeyboard,
  storyActionKeyboard,
  usersPageKeyboard,
} from './keyboards/admin.keyboard';

const MEDALS = ['🥇', '🥈', '🥉'];

@Injectable()
export class AdminUpdate implements OnModuleInit {
  private readonly logger = new Logger(AdminUpdate.name);

  constructor(
    @Inject(BOT) private readonly bot: Bot,
    private readonly adminService: AdminService,
    private readonly storyService: StoryService,
  ) {}

  onModuleInit(): void {
    const composer = new Composer<Context>();

    // Block non-admins from all handlers in this composer.
    composer.use(async (ctx, next) => {
      if (!this.isAdmin(ctx)) {
        if (ctx.callbackQuery) await ctx.answerCallbackQuery();
        return;
      }
      return next();
    });

    composer.command('admin', (ctx) => this.onAdminCommand(ctx));
    composer.hears(MAIN_MENU.ADMIN_PANEL, (ctx) => this.onAdminCommand(ctx));
    composer.callbackQuery(ADMIN_CB.MENU, (ctx) => this.onMenu(ctx));
    composer.callbackQuery(ADMIN_CB.USERS, (ctx) => this.onUsers(ctx));
    composer.callbackQuery(ADMIN_CB.STATS, (ctx) => this.onStats(ctx));
    composer.callbackQuery(ADMIN_CB.LEADERBOARD, (ctx) => this.onLeaderboard(ctx));
    composer.callbackQuery(ADMIN_CB.STORIES, (ctx) => this.onStories(ctx));
    composer.callbackQuery(ADMIN_CB.APPROVE, (ctx) => this.onApprove(ctx));
    composer.callbackQuery(ADMIN_CB.REJECT, (ctx) => this.onReject(ctx));

    this.bot.use(composer);
    this.logger.log('Admin handlers registered');
  }

  private isAdmin(ctx: Context): boolean {
    const id = ctx.from?.id;
    return id !== undefined && this.adminService.isAdmin(BigInt(id));
  }

  // ─── /admin command ────────────────────────────────────────────────────────

  private async onAdminCommand(ctx: Context): Promise<void> {
    await ctx.reply("👑 *Admin Panel*\n\nBo'limni tanlang:", {
      parse_mode: 'Markdown',
      reply_markup: adminMenuKeyboard(),
    });
  }

  // ─── Menu ──────────────────────────────────────────────────────────────────

  private async onMenu(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();
    await this.safeEditText(ctx, "👑 *Admin Panel*\n\nBo'limni tanlang:", {
      parse_mode: 'Markdown',
      reply_markup: adminMenuKeyboard(),
    });
  }

  // ─── Users ─────────────────────────────────────────────────────────────────

  private async onUsers(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();
    const [, pageStr] = ctx.match as RegExpMatchArray;
    const page = Math.max(1, parseInt(pageStr, 10));

    const { users, total, totalPages } = await this.adminService.getUsers(page);

    const offset = (page - 1) * 10;
    let text = `👥 *Foydalanuvchilar* — jami ${total} ta\n\n`;
    for (const [i, u] of users.entries()) {
      const name = u.firstName || u.telegramUsername || `#${u.id}`;
      text += `${offset + i + 1}. ${name} — ${u.points.toLocaleString()} ball\n`;
    }
    text += `\n📄 Sahifa ${page}/${Math.max(1, totalPages)}`;

    await this.safeEditText(ctx, text, {
      parse_mode: 'Markdown',
      reply_markup: usersPageKeyboard(page, totalPages),
    });
  }

  // ─── Statistics ─────────────────────────────────────────────────────────────

  private async onStats(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();
    const stats = await this.adminService.getStats();
    const km = (stats.totalDistance / 1000).toFixed(2);

    const text =
      `📊 *Statistika*\n\n` +
      `👥 Jami foydalanuvchilar: *${stats.totalUsers.toLocaleString()}*\n` +
      `✅ Bugun faol: *${stats.activeToday.toLocaleString()}*\n` +
      `📏 Umumiy masofa: *${km} km*\n` +
      `🚶 Umumiy qadamlar: *${stats.totalSteps.toLocaleString()}*\n` +
      `💰 Umumiy ball: *${stats.totalPoints.toLocaleString()}*`;

    await this.safeEditText(ctx, text, {
      parse_mode: 'Markdown',
      reply_markup: backKeyboard(),
    });
  }

  // ─── Leaderboard ────────────────────────────────────────────────────────────

  private async onLeaderboard(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();
    const entries = await this.adminService.getLeaderboard(20);

    let text = '🏆 *Reyting (TOP-20)*\n\n';
    if (entries.length === 0) {
      text += "Hali hech kim yo'q.";
    } else {
      for (const [i, e] of entries.entries()) {
        const prefix = MEDALS[i] ?? `${i + 1}.`;
        const name = e.firstName || e.telegramUsername || `#${e.id}`;
        text += `${prefix} ${name} — ${e.points.toLocaleString()} ball\n`;
      }
    }

    await this.safeEditText(ctx, text, {
      parse_mode: 'Markdown',
      reply_markup: backKeyboard(),
    });
  }

  // ─── Story approvals ────────────────────────────────────────────────────────

  private async onStories(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();
    const pending = await this.storyService.getPendingSubmissions();

    if (pending.length === 0) {
      await this.safeEditText(
        ctx,
        "📸 *Hikoya tasdiqlash*\n\nKo'rib chiqiladigan hikoya yo'q.",
        { parse_mode: 'Markdown', reply_markup: backKeyboard() },
      );
      return;
    }

    await this.safeEditText(
      ctx,
      `📸 *Hikoya tasdiqlash*\n\n${pending.length} ta hikoya kutmoqda:`,
      { parse_mode: 'Markdown', reply_markup: backKeyboard() },
    );

    for (const s of pending) {
      const name = s.user.firstName || s.user.telegramUsername || `#${s.userId}`;
      const captionLine = s.caption ? `\n📝 ${s.caption}` : '';
      await ctx.replyWithPhoto(s.fileId, {
        caption: `👤 *${name}*${captionLine}\n🆔 Hikoya #${s.id}`,
        parse_mode: 'Markdown',
        reply_markup: storyActionKeyboard(s.id),
      });
    }
  }

  private async onApprove(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();
    const [, idStr] = ctx.match as RegExpMatchArray;
    const { alreadyProcessed, userTelegramId } =
      await this.storyService.approveSubmission(parseInt(idStr, 10));

    const caption = alreadyProcessed
      ? "⚠️ Bu hikoya allaqachon ko'rib chiqilgan."
      : '✅ Hikoya tasdiqlandi. Foydalanuvchiga +30 ball berildi.';

    await this.safeEditCaption(ctx, caption);

    if (!alreadyProcessed && userTelegramId) {
      await this.notifyUser(
        ctx,
        userTelegramId,
        "✅ *Hikoyangiz tasdiqlandi!*\n\nHisobingizga *+30 ball* qo'shildi.",
      );
    }
  }

  private async onReject(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();
    const [, idStr] = ctx.match as RegExpMatchArray;
    const { alreadyProcessed, userTelegramId } =
      await this.storyService.rejectSubmission(parseInt(idStr, 10));

    const caption = alreadyProcessed
      ? "⚠️ Bu hikoya allaqachon ko'rib chiqilgan."
      : '❌ Hikoya rad etildi.';

    await this.safeEditCaption(ctx, caption);

    if (!alreadyProcessed && userTelegramId) {
      await this.notifyUser(
        ctx,
        userTelegramId,
        "❌ *Hikoyangiz rad etildi.*\n\nQayta urinib ko'rishingiz mumkin.",
      );
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /** Swallows Telegram's "message is not modified" error; re-throws everything else. */
  private async safeEditText(
    ctx: Context,
    text: string,
    other?: Parameters<typeof ctx.editMessageText>[1],
  ): Promise<void> {
    try {
      await ctx.editMessageText(text, other);
    } catch (err) {
      if (!this.isNotModifiedError(err)) throw err;
    }
  }

  private async safeEditCaption(ctx: Context, caption: string): Promise<void> {
    try {
      await ctx.editMessageCaption({ caption });
    } catch (err) {
      if (!this.isNotModifiedError(err)) throw err;
    }
  }

  private isNotModifiedError(err: unknown): boolean {
    return (
      err instanceof GrammyError &&
      err.description.includes('message is not modified')
    );
  }

  /** Sends a notification to the user's private chat; logs and swallows failures
   *  (e.g. user blocked the bot) so admin actions are never interrupted. */
  private async notifyUser(
    ctx: Context,
    telegramId: bigint,
    text: string,
  ): Promise<void> {
    try {
      await ctx.api.sendMessage(Number(telegramId), text, {
        parse_mode: 'Markdown',
      });
    } catch (err) {
      this.logger.warn(
        `[admin] Could not notify user ${telegramId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
