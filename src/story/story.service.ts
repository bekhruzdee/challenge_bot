import { Injectable } from '@nestjs/common';
import { Language, StoryStatus, StorySubmission } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type StoryWithUser = StorySubmission & {
  user: { firstName: string | null; telegramUsername: string | null };
};

export interface StoryActionResult {
  alreadyProcessed: boolean;
  userTelegramId?: bigint;
  userLanguage?: Language | null;
  isFirstBonus?: boolean;
}

const STORY_FIRST_BONUS = 15;
const STORY_REPEAT_BONUS = 5;

@Injectable()
export class StoryService {
  constructor(private readonly prisma: PrismaService) {}

  createSubmission(
    userId: number,
    fileId: string,
    caption?: string,
    mediaType?: string,
  ): Promise<StorySubmission> {
    return this.prisma.storySubmission.create({
      data: { userId, fileId, caption, mediaType },
    });
  }

  getPendingSubmissions(): Promise<StoryWithUser[]> {
    return this.prisma.storySubmission.findMany({
      where: { status: StoryStatus.PENDING },
      include: {
        user: { select: { firstName: true, telegramUsername: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  countPending(): Promise<number> {
    return this.prisma.storySubmission.count({
      where: { status: StoryStatus.PENDING },
    });
  }

  async approveSubmission(id: number): Promise<StoryActionResult> {
    return this.prisma.$transaction(async (tx) => {
      // A single UPDATE WHERE status=PENDING is the atomic check-and-flip.
      // Only one concurrent caller gets count=1; all others get count=0.
      const { count } = await tx.storySubmission.updateMany({
        where: { id, status: StoryStatus.PENDING },
        data: { status: StoryStatus.APPROVED },
      });

      if (count === 0) return { alreadyProcessed: true };

      const submission = await tx.storySubmission.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              telegramId: true,
              storyBonusGiven: true,
              language: true,
            },
          },
        },
      });

      const isFirstBonus = submission
        ? !submission.user.storyBonusGiven
        : undefined;

      if (submission) {
        const bonus = submission.user.storyBonusGiven
          ? STORY_REPEAT_BONUS
          : STORY_FIRST_BONUS;
        await tx.user.update({
          where: { id: submission.userId },
          data: { points: { increment: bonus }, storyBonusGiven: true },
        });
      }

      return {
        alreadyProcessed: false,
        userTelegramId: submission?.user.telegramId,
        userLanguage: submission?.user.language,
        isFirstBonus,
      };
    });
  }

  async rejectSubmission(id: number): Promise<StoryActionResult> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.storySubmission.updateMany({
        where: { id, status: StoryStatus.PENDING },
        data: { status: StoryStatus.REJECTED },
      });

      if (count === 0) return { alreadyProcessed: true };

      const submission = await tx.storySubmission.findUnique({
        where: { id },
        include: { user: { select: { telegramId: true, language: true } } },
      });

      return {
        alreadyProcessed: false,
        userTelegramId: submission?.user.telegramId,
        userLanguage: submission?.user.language,
      };
    });
  }

  getLastSubmission(userId: number): Promise<StorySubmission | null> {
    return this.prisma.storySubmission.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async hasPendingSubmission(userId: number): Promise<boolean> {
    const hit = await this.prisma.storySubmission.findFirst({
      where: { userId, status: StoryStatus.PENDING },
      select: { id: true },
    });
    return hit !== null;
  }
}
