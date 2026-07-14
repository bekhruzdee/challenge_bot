import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BotChatService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(
    chatId: bigint,
    title: string,
    username: string | null,
    type: string,
    status: string,
  ): Promise<void> {
    await this.prisma.botChat.upsert({
      where: { chatId },
      create: { chatId, title, username, type, status },
      update: { title, username, type, status },
    });
  }
}
