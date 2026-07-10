import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Bot, Composer, Context } from 'grammy';
import { BOT } from '../telegram/telegram.constants';
import { I18nService } from '../i18n/i18n.service';
import { UsersService } from '../users/users.service';
import { StoryService } from './story.service';

@Injectable()
export class StoryUpdate implements OnModuleInit {
  private readonly logger = new Logger(StoryUpdate.name);

  constructor(
    @Inject(BOT) private readonly bot: Bot,
    private readonly usersService: UsersService,
    private readonly storyService: StoryService,
    private readonly i18n: I18nService,
  ) {}

  onModuleInit(): void {
    const composer = new Composer<Context>();

    composer.hears(
      this.i18n.allVariants((t) => t.mainMenu.storyBtn),
      (ctx) => this.onStoryButton(ctx),
    );
    composer.on('message:photo', (ctx) => this.onPhoto(ctx));

    this.bot.use(composer);
    this.logger.log('Story handlers registered');
  }

  private async onStoryButton(ctx: Context): Promise<void> {
    const user = await this.usersService.findByTelegramId(BigInt(ctx.from!.id));
    const t = this.i18n.t(user?.language);
    await ctx.reply(t.story.prompt, { parse_mode: 'Markdown' });
  }

  private async onPhoto(ctx: Context): Promise<void> {
    const telegramId = BigInt(ctx.from!.id);
    const user = await this.usersService.findByTelegramId(telegramId);

    if (!user || !user.registrationCompleted) return;

    const t = this.i18n.t(user.language);

    if (user.storyBonusGiven) {
      await ctx.reply(t.story.alreadyBonused);
      return;
    }

    const hasPending = await this.storyService.hasPendingSubmission(user.id);
    if (hasPending) {
      await ctx.reply(t.story.pending);
      return;
    }

    const photos = ctx.msg!.photo!;
    const fileId = photos[photos.length - 1].file_id;
    const caption = ctx.msg!.caption ?? undefined;

    await this.storyService.createSubmission(user.id, fileId, caption);
    await ctx.reply(t.story.submitted, { parse_mode: 'Markdown' });
  }
}
