import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Bot, Composer, Context, GrammyError } from 'grammy';
import { BOT } from '../telegram/telegram.constants';
import { I18nService } from '../i18n/i18n.service';
import { Translations } from '../i18n/types/translations.interface';
import { UsersService } from '../users/users.service';
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
    private readonly usersService: UsersService,
    private readonly i18n: I18nService,
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
    composer.hears(
      this.i18n.allVariants((t) => t.mainMenu.adminPanelBtn),
      (ctx) => this.onAdminCommand(ctx),
    );
    composer.callbackQuery(ADMIN_CB.MENU, (ctx) => this.onMenu(ctx));
    composer.callbackQuery(ADMIN_CB.USERS, (ctx) => this.onUsers(ctx));
    composer.callbackQuery(ADMIN_CB.STATS, (ctx) => this.onStats(ctx));
    composer.callbackQuery(ADMIN_CB.LEADERBOARD, (ctx) =>
      this.onLeaderboard(ctx),
    );
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

  private async getT(ctx: Context): Promise<Translations> {
    const user = await this.usersService.findByTelegramId(BigInt(ctx.from!.id));
    return this.i18n.t(user?.language);
  }

  // ─── /admin command ────────────────────────────────────────────────────────

  private async onAdminCommand(ctx: Context): Promise<void> {
    const t = await this.getT(ctx);
    await ctx.reply(t.admin.panelTitle, {
      parse_mode: 'Markdown',
      reply_markup: adminMenuKeyboard(t),
    });
  }

  // ─── Menu ──────────────────────────────────────────────────────────────────

  private async onMenu(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();
    const t = await this.getT(ctx);
    await this.safeEditText(ctx, t.admin.panelTitle, {
      parse_mode: 'Markdown',
      reply_markup: adminMenuKeyboard(t),
    });
  }

  // ─── Users ─────────────────────────────────────────────────────────────────

  private async onUsers(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();
    const [, pageStr] = ctx.match as RegExpMatchArray;
    const page = Math.max(1, parseInt(pageStr, 10));

    const [{ users, total, totalPages }, t] = await Promise.all([
      this.adminService.getUsers(page),
      this.getT(ctx),
    ]);

    const offset = (page - 1) * 10;
    const a = t.admin;
    let text = a.usersHeader(total) + '\n\n';
    for (const [i, u] of users.entries()) {
      const name = u.firstName || u.telegramUsername || `#${u.id}`;
      text +=
        a.usersEntryLine(offset + i + 1, name, u.points.toLocaleString()) +
        '\n';
    }
    text += a.usersPage(page, totalPages);

    await this.safeEditText(ctx, text, {
      parse_mode: 'Markdown',
      reply_markup: usersPageKeyboard(page, totalPages, t),
    });
  }

  // ─── Statistics ─────────────────────────────────────────────────────────────

  private async onStats(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();
    const [stats, t] = await Promise.all([
      this.adminService.getStats(),
      this.getT(ctx),
    ]);
    const km = (stats.totalDistance / 1000).toFixed(2);
    const a = t.admin;

    const text =
      `${a.statsTitle}\n\n` +
      `${a.statsTotalUsers(stats.totalUsers)}\n` +
      `${a.statsActiveToday(stats.activeToday)}\n` +
      `${a.statsTotalDist(km)}\n` +
      `${a.statsTotalSteps(stats.totalSteps)}\n` +
      a.statsTotalPoints(stats.totalPoints);

    await this.safeEditText(ctx, text, {
      parse_mode: 'Markdown',
      reply_markup: backKeyboard(t),
    });
  }

  // ─── Leaderboard ────────────────────────────────────────────────────────────

  private async onLeaderboard(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();
    const [entries, t] = await Promise.all([
      this.adminService.getLeaderboard(20),
      this.getT(ctx),
    ]);
    const a = t.admin;

    let text = `${a.leaderboardTitle}\n\n`;
    if (entries.length === 0) {
      text += a.leaderboardEmpty;
    } else {
      for (const [i, e] of entries.entries()) {
        const prefix = MEDALS[i] ?? `${i + 1}.`;
        const name = e.firstName || e.telegramUsername || `#${e.id}`;
        text +=
          a.leaderboardEntry(prefix, name, e.points.toLocaleString()) + '\n';
      }
    }

    await this.safeEditText(ctx, text, {
      parse_mode: 'Markdown',
      reply_markup: backKeyboard(t),
    });
  }

  // ─── Story approvals ────────────────────────────────────────────────────────

  private async onStories(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();
    const [pending, t] = await Promise.all([
      this.storyService.getPendingSubmissions(),
      this.getT(ctx),
    ]);
    const a = t.admin;

    if (pending.length === 0) {
      await this.safeEditText(ctx, `${a.storiesTitle}\n\n${a.storiesEmpty}`, {
        parse_mode: 'Markdown',
        reply_markup: backKeyboard(t),
      });
      return;
    }

    await this.safeEditText(
      ctx,
      `${a.storiesTitle}\n\n${a.storiesPending(pending.length)}`,
      { parse_mode: 'Markdown', reply_markup: backKeyboard(t) },
    );

    for (const s of pending) {
      const name =
        s.user.firstName || s.user.telegramUsername || `#${s.userId}`;
      const captionLine = s.caption ? `\n📝 ${s.caption}` : '';
      await ctx.replyWithPhoto(s.fileId, {
        caption: a.storyCaption(name, captionLine, s.id),
        parse_mode: 'Markdown',
        reply_markup: storyActionKeyboard(s.id, t),
      });
    }
  }

  private async onApprove(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();
    const [, idStr] = ctx.match as RegExpMatchArray;
    const [result, t] = await Promise.all([
      this.storyService.approveSubmission(parseInt(idStr, 10)),
      this.getT(ctx),
    ]);

    const caption = result.alreadyProcessed
      ? t.admin.alreadyProcessed
      : t.admin.approveSuccess;

    await this.safeEditCaption(ctx, caption);

    if (!result.alreadyProcessed && result.userTelegramId) {
      const userT = this.i18n.t(result.userLanguage);
      await this.notifyUser(
        ctx,
        result.userTelegramId,
        userT.admin.userApproved,
      );
    }
  }

  private async onReject(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery();
    const [, idStr] = ctx.match as RegExpMatchArray;
    const [result, t] = await Promise.all([
      this.storyService.rejectSubmission(parseInt(idStr, 10)),
      this.getT(ctx),
    ]);

    const caption = result.alreadyProcessed
      ? t.admin.alreadyProcessed
      : t.admin.rejectSuccess;

    await this.safeEditCaption(ctx, caption);

    if (!result.alreadyProcessed && result.userTelegramId) {
      const userT = this.i18n.t(result.userLanguage);
      await this.notifyUser(
        ctx,
        result.userTelegramId,
        userT.admin.userRejected,
      );
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

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
