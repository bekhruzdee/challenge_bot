import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Bot } from 'grammy';
import { BOT } from './telegram.constants';
import { TelegramService } from './telegram.service';

@Module({
  imports: [ConfigModule],
  providers: [
    TelegramService,
    {
      provide: BOT,
      useFactory: (svc: TelegramService): Bot => svc.getBot(),
      inject: [TelegramService],
    },
  ],
  exports: [TelegramService, BOT],
})
export class TelegramModule {}
