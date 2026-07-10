import { Controller, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { TelegramService } from './telegram.service';

@Controller()
export class TelegramWebhookController {
  constructor(private readonly telegramService: TelegramService) {}

  @Post('webhook')
  async handleUpdate(@Req() req: Request, @Res() res: Response): Promise<void> {
    // @Res() disables NestJS's automatic response — grammy sends it directly.
    await this.telegramService.getWebhookCallback()(req, res);
  }
}
