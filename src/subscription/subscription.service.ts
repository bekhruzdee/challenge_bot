import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot } from 'grammy';
import { BOT } from '../telegram/telegram.constants';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    @Inject(BOT) private readonly bot: Bot,
    private readonly configService: ConfigService,
  ) {}

  async isSubscribed(telegramUserId: number): Promise<boolean> {
    const raw = (this.configService.get<string>('CHANNEL_ID') ?? '').trim();
    if (!raw) {
      this.logger.warn('CHANNEL_ID is not set — subscription gate is disabled');
      return true;
    }

    const channelId = this.normaliseChannelId(raw);

    try {
      const member = await this.bot.api.getChatMember(channelId, telegramUserId);
      this.logger.debug(
        `[sub] channel=${channelId} user=${telegramUserId} → ${member.status}`,
      );
      return ['creator', 'administrator', 'member'].includes(member.status);
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[sub] getChatMember failed — channel=${channelId} user=${telegramUserId}: ${detail}`,
      );
      return false;
    }
  }

  getChannelLink(): string {
    const link = this.configService.get<string>('CHANNEL_LINK', '').trim();
    if (!link) {
      this.logger.warn(
        'CHANNEL_LINK is not set — channel button will have an empty URL',
      );
    }
    return link;
  }

  private normaliseChannelId(raw: string): string | number {
    if (raw.startsWith('@')) return raw;
    if (raw.startsWith('-')) return raw;
    const n = parseInt(raw, 10);
    if (!isNaN(n)) return -n;
    return `@${raw}`;
  }
}
