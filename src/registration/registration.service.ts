import { Injectable } from '@nestjs/common';
import { Language, RegistrationStep, User, UserSession } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { RegistrationData } from './interfaces/registration-data.interface';

const REFERRAL_BONUS_POINTS = 15;

@Injectable()
export class RegistrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
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

  getSession(userId: number): Promise<UserSession | null> {
    return this.prisma.userSession.findUnique({ where: { userId } });
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

    // Award the referral bonus to the referrer exactly once.
    if (user?.referrerId) {
      await this.usersService.addPoints(user.referrerId, REFERRAL_BONUS_POINTS);
    }
  }
}
