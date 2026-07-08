import { Injectable, Logger } from '@nestjs/common';
import { Location, Progress } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { haversineMeters } from './utils/haversine';

const STEP_LENGTH_M    = 0.75;
const DAILY_GOAL_STEPS = 10_000;
const GOAL_BONUS_POINTS = 100;
const MAX_SPEED_KMH    = 15;

export interface LocationResult {
  isFirstLocation: boolean;  // first point of the day — handler must stay silent
  wasFiltered: boolean;      // rejected by a validity/speed gate — handler must stay silent
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

  /** Entry point from the bot handler. Returns null if the user is not in the DB. */
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
    // ── 0. Validate coordinates ──────────────────────────────────────────────
    if (!this.isValidCoordinate(latitude, longitude)) {
      this.logger.warn(
        `[location] userId=${userId} invalid coordinates ${latitude},${longitude} — ignored`,
      );
      return this.filteredResult();
    }

    const today = this.todayUtc();
    const now   = Date.now();

    // ── 1. Load the previous point for today ────────────────────────────────
    const lastLocation = await this.getLastLocationToday(userId, today);

    // ── 2. Always persist the incoming point ────────────────────────────────
    // Even filtered and first-location points become the reference baseline for
    // the next update, preventing a stale anchor from distorting future distances.
    await this.prisma.location.create({ data: { userId, latitude, longitude } });

    // ── 3. First location: only initialise, no progress interaction ─────────
    if (!lastLocation) {
      this.logger.debug(`[location] userId=${userId} — first point saved, tracking initialised`);
      return this.firstLocationResult();
    }

    // ── 4. Distance and speed ────────────────────────────────────────────────
    const distanceM = haversineMeters(
      lastLocation.latitude,
      lastLocation.longitude,
      latitude,
      longitude,
    );
    const elapsedMs = now - lastLocation.recordedAt.getTime();

    // Reject zero or negative elapsed time (clock skew, duplicate update).
    if (elapsedMs <= 0) {
      this.logger.debug(`[location] userId=${userId} elapsedMs=${elapsedMs} — ignored (time)`);
      return this.filteredResult();
    }

    // Reject zero distance (user has not moved).
    if (distanceM === 0) {
      return this.filteredResult();
    }

    // Reject movement faster than MAX_SPEED_KMH (car, GPS jump).
    const speedKmh = (distanceM / (elapsedMs / 1000)) * 3.6;
    if (speedKmh > MAX_SPEED_KMH) {
      this.logger.debug(
        `[location] userId=${userId} speed=${speedKmh.toFixed(1)} km/h — filtered`,
      );
      return this.filteredResult();
    }

    // ── 5. Valid movement: load/create progress and update ───────────────────
    // getOrCreateProgress is intentionally called only here — it is never
    // touched for first-location or filtered updates.
    const progress = await this.getOrCreateProgress(userId, today);

    const newMeters  = progress.totalMeters + distanceM;
    const newSteps   = Math.floor(newMeters / STEP_LENGTH_M);
    const addedSteps = Math.max(0, newSteps - progress.totalSteps);

    const goalJustReached    = !progress.goalReached && newSteps >= DAILY_GOAL_STEPS;
    const alreadyReachedGoal = progress.goalReached;

    // Award the daily bonus exactly once, checked with a secondary flag to be
    // idempotent even if this branch were somehow entered twice.
    if (goalJustReached && !progress.pointsAwarded) {
      await this.usersService.addPoints(userId, GOAL_BONUS_POINTS);
    }

    await this.prisma.progress.update({
      where: { id: progress.id },
      data: {
        totalMeters:   newMeters,
        totalSteps:    newSteps,
        goalReached:   goalJustReached || alreadyReachedGoal,
        pointsAwarded: goalJustReached ? true : progress.pointsAwarded,
      },
    });

    return {
      isFirstLocation:   false,
      wasFiltered:       false,
      addedSteps,
      totalSteps:        newSteps,
      totalMeters:       newMeters,
      remainingSteps:    Math.max(0, DAILY_GOAL_STEPS - newSteps),
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

  // ── Private helpers ──────────────────────────────────────────────────────────

  /** Silent result for all non-first rejected updates (invalid time, distance, speed, coords). */
  private filteredResult(): LocationResult {
    return {
      isFirstLocation:   false,
      wasFiltered:       true,
      addedSteps:        0,
      totalSteps:        0,
      totalMeters:       0,
      remainingSteps:    DAILY_GOAL_STEPS,
      goalJustReached:   false,
      alreadyReachedGoal: false,
    };
  }

  /** Silent result for the first location of the day (initialisation only). */
  private firstLocationResult(): LocationResult {
    return {
      isFirstLocation:   true,
      wasFiltered:       false,
      addedSteps:        0,
      totalSteps:        0,
      totalMeters:       0,
      remainingSteps:    DAILY_GOAL_STEPS,
      goalJustReached:   false,
      alreadyReachedGoal: false,
    };
  }

  private isValidCoordinate(lat: number, lon: number): boolean {
    return (
      isFinite(lat) && isFinite(lon) &&
      lat >= -90 && lat <= 90 &&
      lon >= -180 && lon <= 180
    );
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
