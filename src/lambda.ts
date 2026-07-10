import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from './app.module';
import { TelegramService } from './telegram/telegram.service';
import type { IncomingMessage, ServerResponse } from 'http';

const server = express();

// Cached across warm Lambda invocations; null on cold start.
let bootstrapPromise: Promise<void> | null = null;

function ensureBootstrapped(): Promise<void> {
  // JavaScript is single-threaded: assignment is atomic, so this is safe even
  // if two requests arrive simultaneously during a cold start.
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
        logger: ['log', 'warn', 'error'],
      });

      // enableShutdownHooks() is intentionally omitted: on Vercel/Lambda a
      // SIGTERM would trigger onModuleDestroy() in TelegramService, which calls
      // bot.api.deleteWebhook() and removes the Telegram webhook registration.
      // Without shutdown hooks the process just dies cleanly; the webhook stays.

      await app.init(); // triggers onApplicationBootstrap → bot.api.setWebhook()

      // Register grammy's webhook handler after NestJS has set up its own
      // middleware, so both can coexist on the same Express instance.
      const telegramService = app.get(TelegramService);
      const webhookPath = process.env.WEBHOOK_PATH ?? '/webhook';
      server.post(webhookPath, telegramService.getWebhookCallback());
    })();
  }
  return bootstrapPromise;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  await ensureBootstrapped();
  server(req as express.Request, res as express.Response);
}