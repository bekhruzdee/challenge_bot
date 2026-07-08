import { Injectable, Logger } from '@nestjs/common';
import { Location, Progress } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { haversineMeters } from './utils/haversine';

const STEP_LENGTH_M = 0.75;
const DAILY_GOAL_STEPS = 10_000;
const GOAL_BONUS_POINTS = 100;
const MAX_SPEED_KMH = 15;

export interface LocationResult {
  isFirstLocation: boolean;
  wasFiltered: boolean;     // movement exceeded MAX_SPEED_KMH — distance not counted
  addedSteps: number;
  totalSteps: number;
  totalMeters: number;
  remainingSteps: number;
  goalJustReached: boolean;
  alreadyReachedGoal: boolean;
}

@Injectable()
export class LocationService {
  private readonly logger = new Logger(LocationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  /** Entry point from the bot handler. Returns null if user is not in the DB. */
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
    const now = Date.now();

    // Fetch in parallel — progress row is created here if this is the first update today.
    const [lastLocation, progress] = await Promise.all([
      this.getLastLocationToday(userId, today),
      this.getOrCreateProgress(userId, today),
    ]);

    // Always persist — even a filtered point becomes the new baseline for the next update,
    // which prevents one fast hop from corrupting the entire day's tracking.
    await this.prisma.location.create({ data: { userId, latitude, longitude } });

    // ── Speed gate ────────────────────────────────────────────────────────────
    // Compute distance once; reuse it for both the speed check and step counting.
    let addedMeters = 0;

    if (lastLocation) {
      const distanceM = haversineMeters(
        lastLocation.latitude,
        lastLocation.longitude,
        latitude,
        longitude,
      );
      const elapsedMs = now - lastLocation.recordedAt.getTime();

      if (elapsedMs > 0) {
        const speedKmh = (distanceM / (elapsedMs / 1000)) * 3.6;

        if (speedKmh > MAX_SPEED_KMH) {
          this.logger.debug(
            `[location] userId=${userId} speed=${speedKmh.toFixed(1)} km/h — filtered`,
          );
          // Return current progress unchanged.
          return {
            isFirstLocation: false,
            wasFiltered: true,
            addedSteps: 0,
            totalSteps: progress.totalSteps,
            totalMeters: progress.totalMeters,
            remainingSteps: Math.max(0, DAILY_GOAL_STEPS - progress.totalSteps),
            goalJustReached: false,
            alreadyReachedGoal: progress.goalReached,
          };
        }
      }

      addedMeters = distanceM;
    }

    // ── Step counting and progress update ─────────────────────────────────────
    const newMeters = progress.totalMeters + addedMeters;
    const newSteps = Math.floor(newMeters / STEP_LENGTH_M);
    const addedSteps = Math.max(0, newSteps - progress.totalSteps);

    const goalJustReached = !progress.goalReached && newSteps >= DAILY_GOAL_STEPS;
    const alreadyReachedGoal = progress.goalReached;

    // Award the daily bonus exactly once, atomically with the progress update.
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
      wasFiltered: false,
      addedSteps,
      totalSteps: newSteps,
      totalMeters: newMeters,
      remainingSteps: Math.max(0, DAILY_GOAL_STEPS - newSteps),
      goalJustReached,
      alreadyReachedGoal,
    };
  }

  /** Returns today's Progress row for a user, or null if no location was shared today. */
  getTodayProgress(userId: number): Promise<Progress | null> {
    return this.prisma.progress.findUnique({
      where: { userId_date: { userId, date: this.todayUtc() } },
    });
  }

  private async getLastLocationToday(userId: number, today: Date): Promise<Location | null> {
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    return this.prisma.location.findFirst({
      where: { userId, recordedAt: { gte: today, lt: tomorrow } },
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
