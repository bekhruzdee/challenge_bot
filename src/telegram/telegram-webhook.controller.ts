import { Controller, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { TelegramService } from './telegram.service';

@Controller()
export class TelegramWebhookController {
  constructor(private readonly telegramService: TelegramService) {}

  @Post('webhook')
  async handleUpdate(@Req() req: Request, @Res() res: Response): Promise<void> {
    const cb = this.telegramService.getWebhookCallback();
    if (!cb) {
      // Bot is in polling mode — webhook endpoint should not receive updates.
      res.sendStatus(200);
      return;
    }
    console.log('[webhook] Content-Type:', req.headers['content-type']);
    console.log('[webhook] Body:', JSON.stringify(req.body, null, 2));
    // @Res() disables NestJS's automatic response — grammy sends it directly.
    await cb(req, res, () => {});
  }
}
