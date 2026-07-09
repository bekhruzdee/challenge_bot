import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Bot, Composer, Context } from 'grammy';
import { BOT } from '../telegram/telegram.constants';
import { UsersService } from '../users/users.service';
import { StoryService } from './story.service';
import { MAIN_MENU } from '../main-menu/main-menu.constants';

@Injectable()
export class StoryUpdate implements OnModuleInit {
  private readonly logger = new Logger(StoryUpdate.name);

  constructor(
    @Inject(BOT) private readonly bot: Bot,
    private readonly usersService: UsersService,
    private readonly storyService: StoryService,
  ) {}

  onModuleInit(): void {
    const composer = new Composer<Context>();

    composer.hears(MAIN_MENU.STORY, (ctx) => this.onStoryButton(ctx));
    composer.on('message:photo', (ctx) => this.onPhoto(ctx));

    this.bot.use(composer);
    this.logger.log('Story handlers registered');
  }

  private async onStoryButton(ctx: Context): Promise<void> {
    await ctx.reply(
      '📸 *Hikoya yuborish*\n\n' +
        "Kundalik faolligingiz haqida foto hikoya yuboring.\n" +
        "Admin tasdiqlashidan so'ng *+30 ball* olasiz!\n\n" +
        '📎 Rasm yuboring (ixtiyoriy sarlavha bilan).',
      { parse_mode: 'Markdown' },
    );
  }

  private async onPhoto(ctx: Context): Promise<void> {
    const telegramId = BigInt(ctx.from!.id);
    const user = await this.usersService.findByTelegramId(telegramId);

    if (!user || !user.registrationCompleted) return;

    if (user.storyBonusGiven) {
      await ctx.reply("✅ Siz allaqachon hikoya bonusini oldingiz.");
      return;
    }

    const hasPending = await this.storyService.hasPendingSubmission(user.id);
    if (hasPending) {
      await ctx.reply(
        "⏳ Sizning hikoyangiz ko'rib chiqilmoqda. Iltimos, kuting.",
      );
      return;
    }

    const photos = ctx.msg!.photo!;
    const fileId = photos[photos.length - 1].file_id;
    const caption = ctx.msg!.caption ?? undefined;

    await this.storyService.createSubmission(user.id, fileId, caption);

    await ctx.reply(
      '✅ *Hikoyangiz yuborildi!*\n\n' +
        "Admin ko'rib chiqqandan so'ng sizga *+30 ball* beriladi.",
      { parse_mode: 'Markdown' },
    );
  }
}
