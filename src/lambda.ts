import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from './app.module';
import type { IncomingMessage, ServerResponse } from 'http';

const server = express();
let bootstrapPromise: Promise<void> | null = null;

function ensureBootstrapped(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
        logger: ['log', 'warn', 'error'],
      });

      // enableShutdownHooks() intentionally omitted: SIGTERM would call
      // onModuleDestroy() → bot.api.deleteWebhook(), removing the Telegram webhook.

      await app.init();
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
