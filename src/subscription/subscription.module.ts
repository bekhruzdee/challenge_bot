import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TelegramModule } from '../telegram/telegram.module';
import { SubscriptionService } from './subscription.service';

@Module({
  imports: [ConfigModule, TelegramModule],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
