import { Injectable, Logger } from '@nestjs/common';
import { Location, Progress } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { haversineMeters } from './utils/haversine';

const STEP_LENGTH_M = 0.75;
const DAILY_GOAL_STEPS = 10_000;
const GOAL_BONUS_POINTS = 100;
const MIN_DISTANCE_M = 20;
const MAX_SPEED_KMH = 10;
const MAX_HORIZONTAL_ACCURACY_M = 20;
const MIN_INTERVAL_MS = 30_000; // 30 seconds
const MAX_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes — gap beyond this means tracking was interrupted
const DAILY_STEP_CAP = 40_000;
const NOTIFY_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const SPEED_WARNING_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export type FilterReason =
  | 'invalid_coords'
  | 'poor_accuracy'
  | 'clock_skew'
  | 'too_soon'
  | 'tracking_gap'
  | 'too_close'
  | 'too_fast'
  | 'daily_cap';

export interface LocationResult {
  isFirstLocation: boolean; // first point of the day — handler must stay silent
  wasFiltered: boolean; // rejected by a validity/speed gate — handler must stay silent
  totalSteps: number;
  totalMeters: number;
  remainingSteps: number;
  goalJustReached: boolean;
  alreadyReachedGoal: boolean;
  /** Whether the handler should send a progress notification to the user. */
  shouldNotify: boolean;
  filterReason?: FilterReason;
  speedKmh?: number;
  /** Whether a throttled speed-warning message should be sent. */
  shouldWarnSpeed?: boolean;
  /** True when this update was discarded due to a tracking gap (app paused/closed). */
  wasGapReset?: boolean;
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
    horizontalAccuracy?: number,
  ): Promise<LocationResult | null> {
    const user = await this.usersService.findByTelegramId(telegramId);
    if (!user) return null;
    return this.processLocation(
      user.id,
      latitude,
      longitude,
      horizontalAccuracy,
    );
  }

  async processLocation(
    userId: number,
    latitude: number,
    longitude: number,
    horizontalAccuracy?: number,
  ): Promise<LocationResult> {
    // ── 0. Validate coordinates ──────────────────────────────────────────────
    if (!this.isValidCoordinate(latitude, longitude)) {
      this.logger.warn(
        `[location] userId=${userId} invalid coordinates ${latitude},${longitude} — ignored`,
      );
      return this.filteredResult('invalid_coords');
    }

    // Reject updates with poor GPS accuracy (> 20 m radius).
    if (
      horizontalAccuracy !== undefined &&
      horizontalAccuracy > MAX_HORIZONTAL_ACCURACY_M
    ) {
      this.logger.debug(
        `[location] userId=${userId} accuracy=${horizontalAccuracy}m — filtered (poor accuracy)`,
      );
      return this.filteredResult('poor_accuracy');
    }

    const today = this.todayUtc();
    const now = Date.now();

    // ── 1. Load the previous point for today ────────────────────────────────
    const lastLocation = await this.getLastLocationToday(userId, today);

    // ── 2. Always persist the incoming point ────────────────────────────────
    // Even filtered and first-location points become the reference baseline for
    // the next update, preventing a stale anchor from distorting future distances.
    await this.prisma.location.create({
      data: { userId, latitude, longitude },
    });

    // ── 3. First location: only initialise, no progress interaction ─────────
    if (!lastLocation) {
      this.logger.debug(
        `[location] userId=${userId} — first point saved, tracking initialised`,
      );
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
      this.logger.debug(
        `[location] userId=${userId} elapsedMs=${elapsedMs} — ignored (time)`,
      );
      return this.filteredResult('clock_skew');
    }

    // Reject updates arriving faster than MIN_INTERVAL_MS (Telegram burst, user stationary).
    if (elapsedMs < MIN_INTERVAL_MS) {
      this.logger.debug(
        `[location] userId=${userId} elapsedMs=${elapsedMs} — filtered (too soon)`,
      );
      return this.filteredResult('too_soon');
    }

    // Tracking gap: elapsed time exceeds MAX_INTERVAL_MS, meaning the app was closed
    // or live-location sharing was paused. We have no proof of continuous movement
    // across the gap, so we do not credit distance regardless of the average speed.
    // The persisted point (step 2) becomes the fresh anchor for future updates.
    if (elapsedMs > MAX_INTERVAL_MS) {
      this.logger.debug(
        `[location] userId=${userId} elapsedMs=${elapsedMs} — gap reset (tracking interrupted)`,
      );
      return this.gapResetResult();
    }

    // Reject movement below minimum threshold (GPS noise, user has not meaningfully moved).
    if (distanceM < MIN_DISTANCE_M) {
      return this.filteredResult('too_close');
    }

    // Reject movement faster than MAX_SPEED_KMH (car, GPS jump).
    const speedKmh = (distanceM / (elapsedMs / 1000)) * 3.6;
    if (speedKmh > MAX_SPEED_KMH) {
      this.logger.debug(
        `[location] userId=${userId} speed=${speedKmh.toFixed(1)} km/h — filtered`,
      );
      // Throttled speed warning: at most once per SPEED_WARNING_INTERVAL_MS.
      const progress = await this.getOrCreateProgress(userId, today);
      const lastWarned = progress.lastSpeedWarningAt;
      const msSinceLastWarn = lastWarned
        ? now - lastWarned.getTime()
        : Infinity;
      const shouldWarnSpeed = msSinceLastWarn >= SPEED_WARNING_INTERVAL_MS;
      if (shouldWarnSpeed) {
        await this.prisma.progress.update({
          where: { id: progress.id },
          data: { lastSpeedWarningAt: new Date(now) },
        });
      }
      return this.filteredResult('too_fast', speedKmh, shouldWarnSpeed);
    }

    // ── 5. Valid movement: load/create progress and update ───────────────────
    // getOrCreateProgress is intentionally called only here — it is never
    // touched for first-location or filtered updates.
    const progress = await this.getOrCreateProgress(userId, today);

    // Daily cap: once the user has accumulated DAILY_STEP_CAP steps, stop counting.
    if (progress.totalSteps >= DAILY_STEP_CAP) {
      return this.filteredResult('daily_cap');
    }

    const newMeters = progress.totalMeters + distanceM;
    const newSteps = Math.min(
      Math.floor(newMeters / STEP_LENGTH_M),
      DAILY_STEP_CAP,
    );

    const goalJustReached =
      !progress.goalReached && newSteps >= DAILY_GOAL_STEPS;
    const alreadyReachedGoal = progress.goalReached;

    // Throttle progress notifications to once per 15 minutes; goal messages bypass the gate.
    const lastNotified = progress.lastProgressNotifiedAt;
    const msSinceLastNotify = lastNotified
      ? now - lastNotified.getTime()
      : Infinity;
    const shouldNotify =
      goalJustReached || msSinceLastNotify >= NOTIFY_INTERVAL_MS;

    const progressData = {
      totalMeters: newMeters,
      totalSteps: newSteps,
      goalReached: goalJustReached || alreadyReachedGoal,
      pointsAwarded: goalJustReached ? true : progress.pointsAwarded,
      ...(shouldNotify ? { lastProgressNotifiedAt: new Date(now) } : {}),
    };

    if (goalJustReached && !progress.pointsAwarded) {
      // Atomic: +100 points and pointsAwarded=true commit together or not at all.
      await this.prisma.$transaction(async (tx) => {
        await this.usersService.addPoints(userId, GOAL_BONUS_POINTS, tx);
        await tx.progress.update({
          where: { id: progress.id },
          data: progressData,
        });
      });
    } else {
      await this.prisma.progress.update({
        where: { id: progress.id },
        data: progressData,
      });
    }

    return {
      isFirstLocation: false,
      wasFiltered: false,
      totalSteps: newSteps,
      totalMeters: newMeters,
      remainingSteps: Math.max(0, DAILY_GOAL_STEPS - newSteps),
      goalJustReached,
      alreadyReachedGoal,
      shouldNotify,
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
  private filteredResult(
    reason?: FilterReason,
    speedKmh?: number,
    shouldWarnSpeed?: boolean,
  ): LocationResult {
    return {
      isFirstLocation: false,
      wasFiltered: true,
      totalSteps: 0,
      totalMeters: 0,
      remainingSteps: DAILY_GOAL_STEPS,
      goalJustReached: false,
      alreadyReachedGoal: false,
      shouldNotify: false,
      filterReason: reason,
      speedKmh,
      shouldWarnSpeed,
    };
  }

  /** Silent result when a tracking gap is detected — no steps credited, point becomes new anchor. */
  private gapResetResult(): LocationResult {
    return {
      isFirstLocation: false,
      wasFiltered: true,
      totalSteps: 0,
      totalMeters: 0,
      remainingSteps: DAILY_GOAL_STEPS,
      goalJustReached: false,
      alreadyReachedGoal: false,
      shouldNotify: false,
      filterReason: 'tracking_gap',
      wasGapReset: true,
    };
  }

  /** Silent result for the first location of the day (initialisation only). */
  private firstLocationResult(): LocationResult {
    return {
      isFirstLocation: true,
      wasFiltered: false,
      totalSteps: 0,
      totalMeters: 0,
      remainingSteps: DAILY_GOAL_STEPS,
      goalJustReached: false,
      alreadyReachedGoal: false,
      shouldNotify: false,
    };
  }

  private isValidCoordinate(lat: number, lon: number): boolean {
    return (
      isFinite(lat) &&
      isFinite(lon) &&
      lat >= -90 &&
      lat <= 90 &&
      lon >= -180 &&
      lon <= 180
    );
  }

  private async getLastLocationToday(
    userId: number,
    today: Date,
  ): Promise<Location | null> {
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    return this.prisma.location.findFirst({
      where: { userId, recordedAt: { gte: today, lt: tomorrow } },
      orderBy: { recordedAt: 'desc' },
    });
  }

  private async getOrCreateProgress(
    userId: number,
    date: Date,
  ): Promise<Progress> {
    return this.prisma.progress.upsert({
      where: { userId_date: { userId, date } },
      update: {},
      create: { userId, date },
    });
  }

  private todayUtc(): Date {
    const n = new Date();
    return new Date(
      Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()),
    );
  }
}
