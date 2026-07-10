import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from './app.module';
import { TelegramService } from './telegram/telegram.service';
import type { IncomingMessage, ServerResponse } from 'http';

const server = express();

let bootstrapPromise: Promise<void> | null = null;
// Populated during ensureBootstrapped(); referenced by the route below.
let webhookHandler: express.RequestHandler | null = null;
const webhookPath = process.env.WEBHOOK_PATH ?? '/webhook';

// Must be registered at module load time, BEFORE NestJS bootstraps.
// NestJS adds a catch-all 404 handler to Express at the end of app.init().
// Express processes middleware in registration order, so anything registered
// here sits ahead of that catch-all and will be matched first.
server.use(express.json()); // body must be parsed before grammy's handler runs

server.post(webhookPath, (req, res, next) => {
  // webhookHandler is null only if a request arrives before ensureBootstrapped()
  // completes — the await in the exported handler prevents that in practice.
  if (webhookHandler) return webhookHandler(req, res, next);
  next();
});

function ensureBootstrapped(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
        logger: ['log', 'warn', 'error'],
        // Disable NestJS's auto body-parser: we already called server.use(express.json())
        // above so the stream is pre-consumed before NestJS's routes run.
        bodyParser: false,
      });

      // enableShutdownHooks() intentionally omitted: SIGTERM would call
      // onModuleDestroy() → bot.api.deleteWebhook(), removing the Telegram webhook.

      await app.init(); // NestJS's 404 catch-all is added here, AFTER our route above.
      webhookHandler = app.get(TelegramService).getWebhookCallback();
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
