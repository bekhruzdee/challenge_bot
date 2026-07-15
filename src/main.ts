import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { TelegramService } from './telegram/telegram.service';
import { WebhookExceptionFilter } from './common/filters/webhook-exception.filter';

async function bootstrap() {
  const isProd = process.env.NODE_ENV === 'production';

  const app = await NestFactory.create(AppModule, {
    logger: isProd
      ? ['log', 'warn', 'error']
      : ['log', 'debug', 'warn', 'error', 'verbose'],
  });

  const logger = new Logger('Bootstrap');

  app.useGlobalFilters(new WebhookExceptionFilter());
  app.enableShutdownHooks();

  // In webhook mode, register the Express route before the server starts so
  // Telegram's POST requests land on the handler when onApplicationBootstrap runs.
  if (process.env.BOT_MODE === 'webhook') {
    await app.init();
    const telegramService = app.get(TelegramService);
    const path = process.env.WEBHOOK_PATH ?? '/webhook';
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    app
      .getHttpAdapter()
      .getInstance()
      .post(path, telegramService.getWebhookCallback());
    logger.log(`Webhook route registered at ${path}`);
  }

  const port = parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port);
  logger.log(`Application running on port ${port}`);
}

bootstrap().catch((err: unknown) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
