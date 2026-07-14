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
}

const STORY_BONUS_POINTS = 15;

@Injectable()
export class StoryService {
  constructor(private readonly prisma: PrismaService) {}

  createSubmission(
    userId: number,
    fileId: string,
    caption?: string,
  ): Promise<StorySubmission> {
    return this.prisma.storySubmission.create({
      data: { userId, fileId, caption },
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

      // Defense in depth: storyBonusGiven guards against a second award should
      // the user somehow have had a prior approval on a different submission.
      if (submission && !submission.user.storyBonusGiven) {
        await tx.user.update({
          where: { id: submission.userId },
          data: {
            points: { increment: STORY_BONUS_POINTS },
            storyBonusGiven: true,
          },
        });
      }

      return {
        alreadyProcessed: false,
        userTelegramId: submission?.user.telegramId,
        userLanguage: submission?.user.language,
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

  async hasPendingSubmission(userId: number): Promise<boolean> {
    const hit = await this.prisma.storySubmission.findFirst({
      where: { userId, status: StoryStatus.PENDING },
      select: { id: true },
    });
    return hit !== null;
  }
}
