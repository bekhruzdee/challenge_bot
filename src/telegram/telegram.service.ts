import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot } from 'grammy';

@Injectable()
export class TelegramService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private readonly bot: Bot;

  constructor(private readonly configService: ConfigService) {
    const token = this.configService.get<string>('BOT_TOKEN');
    if (!token) throw new Error('BOT_TOKEN is not defined');
    this.bot = new Bot(token);
  }

  onApplicationBootstrap(): void {
    // Called after all modules are initialised — all handlers are registered by now.
    void this.bot.start({ drop_pending_updates: true });
    this.logger.log('🤖 Telegram Bot started');
  }

  async onModuleDestroy(): Promise<void> {
    await this.bot.stop();
    this.logger.log('🛑 Telegram Bot stopped');
  }

  getBot(): Bot {
    return this.bot;
  }
}
