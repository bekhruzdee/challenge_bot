import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, GrammyError, HttpError, webhookCallback } from 'grammy';
import type { RequestHandler } from 'express';

@Injectable()
export class TelegramService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(TelegramService.name);
  private readonly bot: Bot;
  private readonly mode: 'polling' | 'webhook';
  private webhookCb: RequestHandler | undefined;

  // constructor(private readonly configService: ConfigService) {
  //   const token = this.configService.get<string>('BOT_TOKEN');
  //   if (!token) throw new Error('BOT_TOKEN is not defined');

  //   this.bot = new Bot(token);
  //   this.mode =
  //     this.configService.get<string>('BOT_MODE') === 'webhook'
  //       ? 'webhook'
  //       : 'polling';

  //   const secret = this.configService.get<string>('WEBHOOK_SECRET_TOKEN');
  //   this.webhookCb = webhookCallback(this.bot, 'express', {
  //     secretToken: secret || undefined,
  //   }) as RequestHandler;

  //   this.bot.catch((err) => {
  //     const e = err.error;
  //     if (e instanceof GrammyError) {
  //       this.logger.error(`Telegram API error: ${e.description}`);
  //     } else if (e instanceof HttpError) {
  //       this.logger.error(`HTTP error: ${e.message}`);
  //     } else {
  //       this.logger.error(
  //         'Unhandled bot error',
  //         e instanceof Error ? e.stack : String(e),
  //       );
  //     }
  //   });
  // }

  constructor(private readonly configService: ConfigService) {
    const token = this.configService.get<string>('BOT_TOKEN');
    if (!token) throw new Error('BOT_TOKEN is not defined');

    this.bot = new Bot(token);

    // 👇 Temporary debug middleware
    this.bot.use(async (ctx, next) => {
      console.log('[grammy] update received:', ctx.update.update_id);
      await next();
      console.log('[grammy] update finished:', ctx.update.update_id);
    });

    this.mode =
      this.configService.get<string>('BOT_MODE') === 'webhook'
        ? 'webhook'
        : 'polling';

    this.bot.catch((err) => {
      const e = err.error;
      if (e instanceof GrammyError) {
        this.logger.error(`Telegram API error: ${e.description}`);
      } else if (e instanceof HttpError) {
        this.logger.error(`HTTP error: ${e.message}`);
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
      const domain = this.configService.get<string>('WEBHOOK_DOMAIN');
      const path =
        this.configService.get<string>('WEBHOOK_PATH') ?? '/webhook';
      if (!domain) {
        this.logger.error(
          'WEBHOOK_DOMAIN is not set — cannot register webhook',
        );
        return;
      }
      const url = `${domain}${path}`;
      await this.bot.api.setWebhook(url, { drop_pending_updates: true });
      const secret = this.configService.get<string>('WEBHOOK_SECRET_TOKEN');
      this.webhookCb = webhookCallback(this.bot, 'express', {
        secretToken: secret || undefined,
      }) as RequestHandler;
      this.logger.log(`Bot running in webhook mode, webhook registered at ${url}`);
    } else {
      // Clear any previously registered webhook before starting long polling.
      // grammy refuses to call bot.start() when Telegram reports an active webhook URL.
      await this.bot.api.deleteWebhook();
      void this.bot.start({
        drop_pending_updates: true,
        onStart: (info) =>
          this.logger.log(`Bot started in polling mode (@${info.username})`),
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.mode === 'polling') {
      await this.bot.stop();
      this.logger.log('Bot stopped');
    }
    // Webhook mode: do nothing — deleteWebhook() would break the Vercel deployment.
    // enableShutdownHooks() is not called in lambda.ts, so this hook only fires
    // in local dev when running in polling mode anyway.
  }

  getBot(): Bot {
    return this.bot;
  }

  getWebhookCallback(): RequestHandler | undefined {
    return this.webhookCb;
  }
}
