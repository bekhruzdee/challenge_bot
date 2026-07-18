import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, Composer, Context, GrammyError, NextFunction } from 'grammy';
import { BOT } from '../telegram/telegram.constants';
import { I18nService } from '../i18n/i18n.service';
import { UsersService } from '../users/users.service';
import { StoryService } from './story.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { notSubscribedKeyboard } from '../registration/keyboards/registration.keyboard';

@Injectable()
export class StoryUpdate implements OnModuleInit {
  private readonly logger = new Logger(StoryUpdate.name);
  private readonly adminIds: Set<bigint>;

  constructor(
    @Inject(BOT) private readonly bot: Bot,
    private readonly usersService: UsersService,
    private readonly storyService: StoryService,
    private readonly subscriptionService: SubscriptionService,
    private readonly i18n: I18nService,
    configService: ConfigService,
  ) {
    const raw = configService.get<string>('ADMIN_IDS', '');
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

    composer.use((ctx, next) => this.requireSubscription(ctx, next));

    composer.hears(
      this.i18n.allVariants((t) => t.mainMenu.storyBtn),
      (ctx) => this.onStoryButton(ctx),
    );
    composer.on('message:photo', (ctx, next) => this.onPhoto(ctx, next));
    composer.on('message:video_note', (ctx, next) => this.onVideoNote(ctx, next));

    this.bot.use(composer);
    this.logger.log('Story handlers registered');
  }

  // ─── Subscription guard ──────────────────────────────────────────────────────

  private async requireSubscription(
    ctx: Context,
    next: NextFunction,
  ): Promise<void> {
    if (!ctx.from) return next();
    if (this.adminIds.has(BigInt(ctx.from.id))) return next();
    const user = await this.usersService.findByTelegramId(BigInt(ctx.from.id));
    if (!user?.registrationCompleted) return next();

    const subscribed = await this.subscriptionService.isSubscribed(ctx.from.id);
    if (!subscribed) {
      const t = this.i18n.t(user.language);
      await this.safeReply(ctx, t.registration.notSubscribed, {
        reply_markup: notSubscribedKeyboard(t, this.subscriptionService.getChannelLink()),
      });
      return;
    }
    return next();
  }

  private async onStoryButton(ctx: Context): Promise<void> {
    if (this.adminIds.has(BigInt(ctx.from!.id))) return;
    const user = await this.usersService.findByTelegramId(BigInt(ctx.from!.id));
    const t = this.i18n.t(user?.language);
    const prompt = user?.storyBonusGiven ? t.story.promptRepeat : t.story.prompt;
    await this.safeReply(ctx, prompt, { parse_mode: 'Markdown' });
  }

  private async onPhoto(ctx: Context, next: NextFunction): Promise<void> {
    if (this.adminIds.has(BigInt(ctx.from!.id))) return next();
    const telegramId = BigInt(ctx.from!.id);
    const user = await this.usersService.findByTelegramId(telegramId);

    if (!user || !user.registrationCompleted) return;

    const t = this.i18n.t(user.language);

    const last = await this.storyService.getLastSubmission(user.id);
    if (last) {
      const remaining =
        24 * 60 * 60 * 1000 - (Date.now() - last.createdAt.getTime());
      if (remaining > 0) {
        const hoursLeft = Math.ceil(remaining / (60 * 60 * 1000));
        await this.safeReply(ctx, t.story.cooldown(hoursLeft));
        return;
      }
    }

    const hasPending = await this.storyService.hasPendingSubmission(user.id);
    if (hasPending) {
      await this.safeReply(ctx, t.story.pending);
      return;
    }

    const photos = ctx.msg!.photo!;
    const fileId = photos[photos.length - 1].file_id;
    const caption = ctx.msg!.caption ?? undefined;

    await this.storyService.createSubmission(user.id, fileId, caption, 'photo');
    await this.safeReply(ctx, t.story.submitted, { parse_mode: 'Markdown' });
  }

  private async onVideoNote(ctx: Context, next: NextFunction): Promise<void> {
    if (this.adminIds.has(BigInt(ctx.from!.id))) return next();
    const telegramId = BigInt(ctx.from!.id);
    const user = await this.usersService.findByTelegramId(telegramId);

    if (!user || !user.registrationCompleted) return;

    const t = this.i18n.t(user.language);

    const last = await this.storyService.getLastSubmission(user.id);
    if (last) {
      const remaining =
        24 * 60 * 60 * 1000 - (Date.now() - last.createdAt.getTime());
      if (remaining > 0) {
        const hoursLeft = Math.ceil(remaining / (60 * 60 * 1000));
        await this.safeReply(ctx, t.story.cooldown(hoursLeft));
        return;
      }
    }

    const hasPending = await this.storyService.hasPendingSubmission(user.id);
    if (hasPending) {
      await this.safeReply(ctx, t.story.pending);
      return;
    }

    const fileId = ctx.msg!.video_note!.file_id;
    await this.storyService.createSubmission(user.id, fileId, undefined, 'video_note');
    await this.safeReply(ctx, t.story.submitted, { parse_mode: 'Markdown' });
  }

  private async safeReply(
    ctx: Context,
    text: string,
    other?: Parameters<Context['reply']>[1],
  ): Promise<void> {
    try {
      await ctx.reply(text, other);
    } catch (err) {
      this.logger.warn(
        `[story] ctx.reply failed: ${err instanceof GrammyError ? err.description : String(err)}`,
      );
    }
  }
}
