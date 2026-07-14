import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TelegramModule } from '../telegram/telegram.module';
import { BotChatService } from './bot-chat.service';
import { BotChatUpdate } from './bot-chat.update';

@Module({
  imports: [PrismaModule, TelegramModule],
  providers: [BotChatService, BotChatUpdate],
  exports: [BotChatService],
})
export class BotChatModule {}
