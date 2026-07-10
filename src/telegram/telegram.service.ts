import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, GrammyError, HttpError, webhookCallback } from 'grammy';

@Injectable()
export class TelegramService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(TelegramService.name);
  private readonly bot: Bot;
  private readonly mode: 'polling' | 'webhook';

  constructor(private readonly configService: ConfigService) {
    // --- DIAGNOSTIC: remove after confirming env vars load correctly ---
    this.logger.warn(`[diag] NODE_ENV=${process.env.NODE_ENV ?? 'undefined'}`);
    this.logger.warn(`[diag] VERCEL=${process.env.VERCEL ?? 'undefined'}`);
    this.logger.warn(
      `[diag] BOT_TOKEN in process.env=${process.env.BOT_TOKEN ? 'SET' : 'UNSET/EMPTY'}`,
    );
    this.logger.warn(
      `[diag] BOT_TOKEN via ConfigService=${this.configService.get('BOT_TOKEN') ? 'SET' : 'UNSET/EMPTY'}`,
    );
    this.logger.warn(
      `[diag] DATABASE_URL via ConfigService=${this.configService.get('DATABASE_URL') ? 'SET' : 'UNSET/EMPTY'}`,
    );
    // --- END DIAGNOSTIC ---

    const token = this.configService.get<string>('BOT_TOKEN');

    if (!token) {
      throw new Error('BOT_TOKEN is not defined');
    }

    this.bot = new Bot(token);

    this.mode =
      this.configService.get<string>('BOT_MODE') === 'webhook'
        ? 'webhook'
        : 'polling';

    // Global per-update error handler — prevents unhandled rejections.
    this.bot.catch((err) => {
      const e = err.error;

      if (e instanceof GrammyError) {
        this.logger.error(`Telegram API error: ${e.description}`);
      } else if (e instanceof HttpError) {
        this.logger.error(
          `HTTP error communicating with Telegram: ${e.message}`,
        );
      } else {
        this.logger.error(
          'Unhandled bot error',
          e instanceof Error ? e.stack : String(e),
        );
      }
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    if (this.mode === 'webhook') {
      const domain = this.configService.getOrThrow<string>('WEBHOOK_DOMAIN');
      const path = this.configService.get<string>('WEBHOOK_PATH') ?? '/webhook';
      const secret = this.configService.get<string>('WEBHOOK_SECRET_TOKEN');
      await this.bot.api.setWebhook(`${domain}${path}`, {
        secret_token: secret || undefined,
        drop_pending_updates: true,
      });
      this.logger.log(`Bot started in webhook mode: ${domain}${path}`);
    } else {
      void this.bot.start({
        drop_pending_updates: true,
        onStart: (info) =>
          this.logger.log(`Bot started in polling mode (@${info.username})`),
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.mode === 'webhook') {
      await this.bot.api.deleteWebhook();
    } else {
      await this.bot.stop();
    }
    this.logger.log('Bot stopped');
  }

  getBot(): Bot {
    return this.bot;
  }

  /** Express-compatible handler for incoming webhook updates (webhook mode only). */
  getWebhookCallback() {
    const secret = this.configService.get<string>('WEBHOOK_SECRET_TOKEN');
    return webhookCallback(this.bot, 'express', {
      secretToken: secret || undefined,
    });
  }
}
