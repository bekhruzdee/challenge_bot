import { Injectable } from '@nestjs/common';
import { Location, Progress } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { haversineMeters } from './utils/haversine';

const STEP_LENGTH_M = 0.75;
const DAILY_GOAL_STEPS = 10_000;
const GOAL_BONUS_POINTS = 100;

export interface LocationResult {
  isFirstLocation: boolean;
  addedSteps: number;
  totalSteps: number;
  totalMeters: number;
  goalJustReached: boolean;
  alreadyReachedGoal: boolean;
}

@Injectable()
export class LocationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Entry point called from the bot handler.
   * Returns null when the Telegram user is not found in the database.
   */
  async processLocationByTelegramId(
    telegramId: bigint,
    latitude: number,
    longitude: number,
  ): Promise<LocationResult | null> {
    const user = await this.usersService.findByTelegramId(telegramId);
    if (!user) return null;
    return this.processLocation(user.id, latitude, longitude);
  }

  async processLocation(
    userId: number,
    latitude: number,
    longitude: number,
  ): Promise<LocationResult> {
    const today = this.todayUtc();
    const lastLocation = await this.getLastLocationToday(userId, today);

    // First point of the day has no previous reference — distance delta is 0.
    const addedMeters = lastLocation
      ? haversineMeters(lastLocation.latitude, lastLocation.longitude, latitude, longitude)
      : 0;

    await this.prisma.location.create({ data: { userId, latitude, longitude } });

    const progress = await this.getOrCreateProgress(userId, today);

    const newMeters = progress.totalMeters + addedMeters;
    const newSteps = Math.floor(newMeters / STEP_LENGTH_M);
    const addedSteps = Math.max(0, newSteps - progress.totalSteps);

    const goalJustReached = !progress.goalReached && newSteps >= DAILY_GOAL_STEPS;
    const alreadyReachedGoal = progress.goalReached;

    // Award the daily bonus exactly once.
    if (goalJustReached && !progress.pointsAwarded) {
      await this.usersService.addPoints(userId, GOAL_BONUS_POINTS);
    }

    await this.prisma.progress.update({
      where: { id: progress.id },
      data: {
        totalMeters: newMeters,
        totalSteps: newSteps,
        goalReached: goalJustReached || alreadyReachedGoal,
        pointsAwarded: goalJustReached ? true : progress.pointsAwarded,
      },
    });

    return {
      isFirstLocation: lastLocation === null,
      addedSteps,
      totalSteps: newSteps,
      totalMeters: newMeters,
      goalJustReached,
      alreadyReachedGoal,
    };
  }

  private async getLastLocationToday(userId: number, today: Date): Promise<Location | null> {
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    return this.prisma.location.findFirst({
      where: {
        userId,
        recordedAt: { gte: today, lt: tomorrow },
      },
      orderBy: { recordedAt: 'desc' },
    });
  }

  private async getOrCreateProgress(userId: number, date: Date): Promise<Progress> {
    return this.prisma.progress.upsert({
      where: { userId_date: { userId, date } },
      update: {},
      create: { userId, date },
    });
  }

  private todayUtc(): Date {
    const n = new Date();
    return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
  }
}
