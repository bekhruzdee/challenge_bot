import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RegistrationStep } from '@prisma/client';
import { Bot, Composer, Context, GrammyError, NextFunction } from 'grammy';
import { BOT } from '../telegram/telegram.constants';
import { I18nService } from '../i18n/i18n.service';
import { Translations } from '../i18n/types/translations.interface';
import { UsersService } from '../users/users.service';
import { StoryService } from '../story/story.service';
import { InstagramService } from '../instagram/instagram.service';
import { RegistrationService } from '../registration/registration.service';
import { AdminService } from './admin.service';
import { ADMIN_CB } from './admin.constants';
import {
  adminMenuKeyboard,
  backKeyboard,
  broadcastConfirmKeyboard,
  instagramActionKeyboard,
  storyActionKeyboard,
  usersPageKeyboard,
} from './keyboards/admin.keyboard';

const MEDALS = ['🥇', '🥈', '🥉'];

@Injectable()
export class AdminUpdate implements OnModuleInit {
  private readonly logger = new Logger(AdminUpdate.name);
  private readonly broadcastAwaitingAdmins = new Set<bigint>();
  private readonly pendingBroadcasts = new Map<
    bigint,
    NonNullable<Context['message']>
  >();

  constructor(
    @Inject(BOT) private readonly bot: Bot,
    private readonly adminService: AdminService,
    private readonly storyService: StoryService,
    private readonly instagramService: InstagramService,
    private readonly registrationService: RegistrationService,
    private readonly usersService: UsersService,
    private readonly i18n: I18nService,
  ) {}

  onModuleInit(): void {
    const composer = new Composer<Context>();

    // Block non-admins from all handlers in this composer.
    composer.use(async (ctx, next) => {
      if (!this.isAdmin(ctx)) {
        if (ctx.callbackQuery) await this.safeAnswerCallbackQuery(ctx);
        return;
      }
      return next();
    });

    // Broadcast message capture — must be first to intercept pending messages.
    composer.on('message', (ctx, next) => this.onBroadcastMessage(ctx, next));

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
    composer.callbackQuery(ADMIN_CB.INSTAGRAM, (ctx) => this.onInstagram(ctx));
    composer.callbackQuery(ADMIN_CB.INSTAGRAM_APPROVE, (ctx) =>
      this.onInstagramApprove(ctx),
    );
    composer.callbackQuery(ADMIN_CB.INSTAGRAM_REJECT, (ctx) =>
      this.onInstagramReject(ctx),
    );
    composer.callbackQuery(ADMIN_CB.BROADCAST, (ctx) => this.onBroadcast(ctx));
    composer.callbackQuery(ADMIN_CB.BROADCAST_CONFIRM, (ctx) =>
      this.onBroadcastConfirm(ctx),
    );
    composer.callbackQuery(ADMIN_CB.BROADCAST_CANCEL, (ctx) =>
      this.onBroadcastCancel(ctx),
    );

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
    try {
      await ctx.reply(t.admin.panelTitle, {
        parse_mode: 'Markdown',
        reply_markup: adminMenuKeyboard(t),
      });
    } catch (err) {
      this.logger.warn(
        `[admin] ctx.reply failed: ${err instanceof GrammyError ? err.description : String(err)}`,
      );
    }
  }

  // ─── Menu ──────────────────────────────────────────────────────────────────

  private async onMenu(ctx: Context): Promise<void> {
    await this.safeAnswerCallbackQuery(ctx);
    const t = await this.getT(ctx);
    await this.safeEditText(ctx, t.admin.panelTitle, {
      parse_mode: 'Markdown',
      reply_markup: adminMenuKeyboard(t),
    });
  }

  // ─── Users ─────────────────────────────────────────────────────────────────

  private async onUsers(ctx: Context): Promise<void> {
    await this.safeAnswerCallbackQuery(ctx);
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
    await this.safeAnswerCallbackQuery(ctx);
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
    await this.safeAnswerCallbackQuery(ctx);
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
    await this.safeAnswerCallbackQuery(ctx);
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
      const captionText = a.storyCaption(name, captionLine, s.id);
      try {
        if (s.mediaType === 'video_note') {
          await ctx.api.sendVideoNote(ctx.chat!.id, s.fileId);
          await ctx.reply(captionText, {
            parse_mode: 'Markdown',
            reply_markup: storyActionKeyboard(s.id, t),
          });
        } else {
          await ctx.replyWithPhoto(s.fileId, {
            caption: captionText,
            parse_mode: 'Markdown',
            reply_markup: storyActionKeyboard(s.id, t),
          });
        }
      } catch (err) {
        this.logger.warn(
          `[admin] send failed for story ${s.id}: ${err instanceof GrammyError ? err.description : String(err)}`,
        );
      }
    }
  }

  private async onApprove(ctx: Context): Promise<void> {
    await this.safeAnswerCallbackQuery(ctx);
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
      const approvedMsg = result.isFirstBonus
        ? userT.admin.userApproved
        : userT.admin.userApprovedRepeat;
      await this.notifyUser(ctx, result.userTelegramId, approvedMsg);
    }
  }

  private async onReject(ctx: Context): Promise<void> {
    await this.safeAnswerCallbackQuery(ctx);
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

  // ─── Instagram approvals ────────────────────────────────────────────────────

  private async onInstagram(ctx: Context): Promise<void> {
    await this.safeAnswerCallbackQuery(ctx);
    const [pending, t] = await Promise.all([
      this.instagramService.getPendingVerifications(),
      this.getT(ctx),
    ]);
    const a = t.admin;

    if (pending.length === 0) {
      await this.safeEditText(
        ctx,
        `${a.instagramTitle}\n\n${a.instagramEmpty}`,
        { parse_mode: 'Markdown', reply_markup: backKeyboard(t) },
      );
      return;
    }

    await this.safeEditText(
      ctx,
      `${a.instagramTitle}\n\n${a.instagramPendingCount(pending.length)}`,
      { parse_mode: 'Markdown', reply_markup: backKeyboard(t) },
    );

    for (const v of pending) {
      const name =
        v.user.firstName || v.user.telegramUsername || `#${v.userId}`;
      try {
        await ctx.replyWithPhoto(v.fileId, {
          caption: a.instagramCaption(name, v.id),
          parse_mode: 'Markdown',
          reply_markup: instagramActionKeyboard(v.id, t),
        });
      } catch (err) {
        this.logger.warn(
          `[admin] replyWithPhoto failed for instagram verification ${v.id}: ${err instanceof GrammyError ? err.description : String(err)}`,
        );
      }
    }
  }

  private async onInstagramApprove(ctx: Context): Promise<void> {
    await this.safeAnswerCallbackQuery(ctx);
    const [, idStr] = ctx.match as RegExpMatchArray;
    const id = parseInt(idStr, 10);

    const [result, t] = await Promise.all([
      this.instagramService.approveVerification(id),
      this.getT(ctx),
    ]);
    const a = t.admin;

    await this.safeEditCaption(
      ctx,
      result.alreadyProcessed ? a.alreadyProcessed : a.instagramApproveSuccess,
    );

    if (!result.alreadyProcessed && result.userTelegramId) {
      const userT = this.i18n.t(result.userLanguage);
      await this.notifyUser(
        ctx,
        result.userTelegramId,
        userT.registration.instagramApproved,
      );
      await this.notifyUser(
        ctx,
        result.userTelegramId,
        userT.registration.askFirstName,
      );
      if (result.userId) {
        await this.registrationService.upsertSession(
          result.userId,
          RegistrationStep.ASK_FIRST_NAME,
          {},
        );
      }
    }
  }

  private async onInstagramReject(ctx: Context): Promise<void> {
    await this.safeAnswerCallbackQuery(ctx);
    const [, idStr] = ctx.match as RegExpMatchArray;
    const id = parseInt(idStr, 10);

    const [result, t] = await Promise.all([
      this.instagramService.rejectVerification(id),
      this.getT(ctx),
    ]);
    const a = t.admin;

    await this.safeEditCaption(
      ctx,
      result.alreadyProcessed ? a.alreadyProcessed : a.instagramRejectSuccess,
    );

    if (!result.alreadyProcessed && result.userTelegramId) {
      const userT = this.i18n.t(result.userLanguage);
      await this.notifyUser(
        ctx,
        result.userTelegramId,
        userT.registration.instagramRejected,
      );
      if (result.userId) {
        await this.registrationService.upsertSession(
          result.userId,
          RegistrationStep.INSTAGRAM_SUB,
          {},
        );
      }
    }
  }

  // ─── Broadcast ──────────────────────────────────────────────────────────────

  private async onBroadcastMessage(
    ctx: Context,
    next: NextFunction,
  ): Promise<void> {
    const adminId = BigInt(ctx.from!.id);
    if (!this.broadcastAwaitingAdmins.has(adminId) || !ctx.message) {
      return next();
    }

    this.broadcastAwaitingAdmins.delete(adminId);
    this.pendingBroadcasts.set(adminId, ctx.message);

    const t = await this.getT(ctx);
    try {
      await ctx.reply(t.admin.broadcastConfirmText, {
        reply_markup: broadcastConfirmKeyboard(),
        reply_to_message_id: ctx.message.message_id,
      });
    } catch (err) {
      this.logger.warn(
        `[admin] broadcast confirm reply failed: ${err instanceof GrammyError ? err.description : String(err)}`,
      );
    }
  }

  private async onBroadcast(ctx: Context): Promise<void> {
    await this.safeAnswerCallbackQuery(ctx);
    const adminId = BigInt(ctx.from!.id);
    this.broadcastAwaitingAdmins.add(adminId);
    const t = await this.getT(ctx);
    await this.safeEditText(ctx, t.admin.broadcastPrompt);
  }

  private async onBroadcastConfirm(ctx: Context): Promise<void> {
    await this.safeAnswerCallbackQuery(ctx);
    const adminId = BigInt(ctx.from!.id);
    const msg = this.pendingBroadcasts.get(adminId);
    const t = await this.getT(ctx);

    if (!msg) {
      await this.safeEditText(ctx, t.admin.broadcastNotFound);
      return;
    }

    this.pendingBroadcasts.delete(adminId);
    await this.safeEditText(ctx, t.admin.broadcastSending);

    const { sent, failed } = await this.doBroadcast(ctx, msg);
    await this.safeEditText(ctx, t.admin.broadcastDone(sent, failed));
  }

  private async onBroadcastCancel(ctx: Context): Promise<void> {
    await this.safeAnswerCallbackQuery(ctx);
    const adminId = BigInt(ctx.from!.id);
    this.pendingBroadcasts.delete(adminId);
    this.broadcastAwaitingAdmins.delete(adminId);
    const t = await this.getT(ctx);
    await this.safeEditText(ctx, t.admin.broadcastCancelled);
  }

  private async doBroadcast(
    ctx: Context,
    msg: NonNullable<Context['message']>,
  ): Promise<{ sent: number; failed: number }> {
    const users = await this.adminService.getAllActiveUsers();
    let sent = 0;
    let failed = 0;

    for (const user of users) {
      const chatId = Number(user.telegramId);
      try {
        if (msg.text) {
          await ctx.api.sendMessage(chatId, msg.text, {
            entities: msg.entities,
          });
        } else if (msg.photo) {
          const fileId = msg.photo[msg.photo.length - 1].file_id;
          await ctx.api.sendPhoto(chatId, fileId, {
            caption: msg.caption,
            caption_entities: msg.caption_entities,
          });
        } else if (msg.video) {
          await ctx.api.sendVideo(chatId, msg.video.file_id, {
            caption: msg.caption,
            caption_entities: msg.caption_entities,
          });
        } else if (msg.voice) {
          await ctx.api.sendVoice(chatId, msg.voice.file_id, {
            caption: msg.caption,
          });
        } else if (msg.document) {
          await ctx.api.sendDocument(chatId, msg.document.file_id, {
            caption: msg.caption,
            caption_entities: msg.caption_entities,
          });
        } else if (msg.animation) {
          await ctx.api.sendAnimation(chatId, msg.animation.file_id, {
            caption: msg.caption,
            caption_entities: msg.caption_entities,
          });
        } else if (msg.video_note) {
          await ctx.api.sendVideoNote(chatId, msg.video_note.file_id);
        }
        sent++;
      } catch (err) {
        failed++;
        const desc = err instanceof GrammyError ? err.description : String(err);
        if (
          !desc.includes('bot was blocked') &&
          !desc.includes('chat not found') &&
          !desc.includes('user is deactivated') &&
          !desc.includes('PEER_ID_INVALID') &&
          !desc.includes('Forbidden')
        ) {
          this.logger.warn(`[admin] broadcast error for ${chatId}: ${desc}`);
        }
      }
      await new Promise<void>((r) => setTimeout(r, 35));
    }

    return { sent, failed };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async safeAnswerCallbackQuery(ctx: Context): Promise<void> {
    try {
      await ctx.answerCallbackQuery();
    } catch (err) {
      this.logger.warn(
        `[admin] answerCallbackQuery failed: ${err instanceof GrammyError ? err.description : String(err)}`,
      );
    }
  }

  private async safeEditText(
    ctx: Context,
    text: string,
    other?: Parameters<typeof ctx.editMessageText>[1],
  ): Promise<void> {
    try {
      await ctx.editMessageText(text, other);
    } catch (err) {
      if (!this.isNotModifiedError(err)) {
        this.logger.warn(
          `[admin] editMessageText failed: ${err instanceof GrammyError ? err.description : String(err)}`,
        );
      }
    }
  }

  private async safeEditCaption(ctx: Context, caption: string): Promise<void> {
    try {
      await ctx.editMessageCaption({ caption });
    } catch (err) {
      if (this.isNotModifiedError(err)) return;
      // For video_note submissions the keyboard sits on a text message — fall back.
      try {
        await ctx.editMessageText(caption);
      } catch (err2) {
        if (!this.isNotModifiedError(err2)) {
          this.logger.warn(
            `[admin] editMessageCaption/Text failed: ${err instanceof GrammyError ? err.description : String(err)}`,
          );
        }
      }
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
