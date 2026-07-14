import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Bot, Composer, Context } from 'grammy';
import { BOT } from '../telegram/telegram.constants';
import { BotChatService } from './bot-chat.service';

@Injectable()
export class BotChatUpdate implements OnModuleInit {
  private readonly logger = new Logger(BotChatUpdate.name);

  constructor(
    @Inject(BOT) private readonly bot: Bot,
    private readonly botChatService: BotChatService,
  ) {}

  onModuleInit(): void {
    const composer = new Composer<Context>();
    composer.on('my_chat_member', (ctx) => this.onMyChatMember(ctx));
    this.bot.use(composer);
    this.logger.log('BotChat handlers registered');
  }

  private async onMyChatMember(ctx: Context): Promise<void> {
    const { chat, new_chat_member } = ctx.myChatMember!;

    // Private chats (user blocks/unblocks the bot) have no title — skip them.
    if (chat.type === 'private') return;

    await this.botChatService.upsert(
      BigInt(chat.id),
      chat.title,
      'username' in chat ? (chat.username ?? null) : null,
      chat.type,
      new_chat_member.status,
    );

    this.logger.debug(
      `[bot-chat] chatId=${chat.id} type=${chat.type} status=${new_chat_member.status}`,
    );
  }
}
