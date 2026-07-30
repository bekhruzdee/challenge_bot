import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Language, RegistrationStep, User, UserSession } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { RegistrationData } from './interfaces/registration-data.interface';
import { cacheSerialize, cacheDeserialize } from '../redis/cache-utils';

const REFERRAL_BONUS_POINTS = 10;

@Injectable()
export class RegistrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async getOrCreateUser(
    telegramId: bigint,
    telegramUsername?: string,
    firstName?: string,
    lastName?: string,
    referrerId?: number,
  ): Promise<User> {
    const existing = await this.usersService.findByTelegramId(telegramId);
    if (existing) {
      // Never overwrite an existing referrerId on repeat /start commands.
      return this.usersService.update(existing.id, {
        telegramUsername,
        lastActivityAt: new Date(),
      });
    }
    return this.usersService.create({
      telegramId,
      telegramUsername,
      firstName,
      lastName,
      referrerId,
    });
  }

  getUserByTelegramId(telegramId: bigint): Promise<User | null> {
    return this.usersService.findByTelegramId(telegramId);
  }

  async getSession(userId: number): Promise<UserSession | null> {
    const key = `session:${userId}`;
    const raw = await this.cache.get<string>(key);
    if (raw !== undefined) return cacheDeserialize<UserSession | null>(raw);
    const session = await this.prisma.userSession.findUnique({
      where: { userId },
    });
    await this.cache.set(key, cacheSerialize(session), 300_000);
    return session;
  }

  async upsertSession(
    userId: number,
    step: RegistrationStep,
    data: Partial<RegistrationData>,
  ): Promise<void> {
    await this.prisma.userSession.upsert({
      where: { userId },
      update: { step, data },
      create: { userId, step, data },
    });
    await this.cache.del(`session:${userId}`);
  }

  setLanguage(userId: number, language: Language): Promise<User> {
    return this.usersService.update(userId, { language });
  }

  async completeRegistration(
    userId: number,
    data: RegistrationData,
    region: string,
  ): Promise<void> {
    // Read referrerId before updating so we can award the bonus afterwards.
    const user = await this.usersService.findById(userId);

    await this.usersService.update(userId, {
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      region,
      registrationCompleted: true,
      lastActivityAt: new Date(),
    });

    await this.prisma.userSession.delete({ where: { userId } });
    await this.cache.del(`session:${userId}`);

    // Award the referral bonus to the referrer exactly once.
    if (user?.referrerId) {
      const referralCount = await this.prisma.user.count({
        where: { referrerId: user.referrerId },
      });
      if (referralCount <= 1) {
        await this.usersService.addPoints(
          user.referrerId,
          REFERRAL_BONUS_POINTS,
        );
      }
    }
  }
}
