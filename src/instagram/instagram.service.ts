import { Injectable } from '@nestjs/common';
import {
  InstagramStatus,
  InstagramVerification,
  Language,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type InstagramVerificationWithUser = InstagramVerification & {
  user: {
    id: number;
    firstName: string | null;
    telegramUsername: string | null;
    telegramId: bigint;
    language: Language | null;
  };
};

export interface InstagramActionResult {
  alreadyProcessed: boolean;
  userId?: number;
  userTelegramId?: bigint;
  userLanguage?: Language | null;
}

@Injectable()
export class InstagramService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrUpdateVerification(
    userId: number,
    fileId: string,
  ): Promise<void> {
    await this.prisma.instagramVerification.upsert({
      where: { userId },
      update: { fileId, status: InstagramStatus.PENDING },
      create: { userId, fileId },
    });
  }

  getPendingVerifications(): Promise<InstagramVerificationWithUser[]> {
    return this.prisma.instagramVerification.findMany({
      where: { status: InstagramStatus.PENDING },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            telegramUsername: true,
            telegramId: true,
            language: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async approveVerification(id: number): Promise<InstagramActionResult> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.instagramVerification.updateMany({
        where: { id, status: InstagramStatus.PENDING },
        data: { status: InstagramStatus.APPROVED },
      });

      if (count === 0) return { alreadyProcessed: true };

      const v = await tx.instagramVerification.findUnique({
        where: { id },
        include: {
          user: { select: { id: true, telegramId: true, language: true } },
        },
      });

      return {
        alreadyProcessed: false,
        userId: v?.user.id,
        userTelegramId: v?.user.telegramId,
        userLanguage: v?.user.language,
      };
    });
  }

  async rejectVerification(id: number): Promise<InstagramActionResult> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.instagramVerification.updateMany({
        where: { id, status: InstagramStatus.PENDING },
        data: { status: InstagramStatus.REJECTED },
      });

      if (count === 0) return { alreadyProcessed: true };

      const v = await tx.instagramVerification.findUnique({
        where: { id },
        include: {
          user: { select: { id: true, telegramId: true, language: true } },
        },
      });

      return {
        alreadyProcessed: false,
        userId: v?.user.id,
        userTelegramId: v?.user.telegramId,
        userLanguage: v?.user.language,
      };
    });
  }

  getVerificationByUserId(
    userId: number,
  ): Promise<InstagramVerification | null> {
    return this.prisma.instagramVerification.findUnique({ where: { userId } });
  }
}
