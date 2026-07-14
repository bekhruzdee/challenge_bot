import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TelegramModule } from '../telegram/telegram.module';
import { UsersModule } from '../users/users.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { StoryService } from './story.service';
import { StoryUpdate } from './story.update';

@Module({
  imports: [PrismaModule, TelegramModule, UsersModule, SubscriptionModule],
  providers: [StoryService, StoryUpdate],
  exports: [StoryService],
})
export class StoryModule {}
