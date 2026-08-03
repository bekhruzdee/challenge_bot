import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { type Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { cacheSerialize, cacheDeserialize } from '../redis/cache-utils';

export interface LeaderboardEntry {
  id: number;
  firstName: string | null;
  telegramUsername: string | null;
  points: number;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async findByTelegramId(telegramId: bigint): Promise<User | null> {
    const key = `user:${telegramId}`;
    const raw = await this.cache.get<string>(key);
    if (raw !== undefined) return cacheDeserialize<User | null>(raw);
    const user = await this.prisma.user.findUnique({ where: { telegramId } });
    await this.cache.set(key, cacheSerialize(user), 60_000);
    return user;
  }

  findById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async create(dto: CreateUserDto): Promise<User> {
    const user = await this.prisma.user.create({ data: dto });
    await this.cache.del(`user:${user.telegramId}`);
    return user;
  }

  async update(id: number, dto: UpdateUserDto): Promise<User> {
    const user = await this.prisma.user.update({ where: { id }, data: dto });
    await this.cache.del(`user:${user.telegramId}`);
    return user;
  }

  async existsByTelegramId(telegramId: bigint): Promise<boolean> {
    const hit = await this.prisma.user.findUnique({
      where: { telegramId },
      select: { id: true },
    });
    return hit !== null;
  }

  async addPoints(
    id: number,
    amount: number,
    tx?: Prisma.TransactionClient,
  ): Promise<User> {
    const user = await (tx ?? this.prisma).user.update({
      where: { id },
      data: { points: { increment: amount } },
    });
    await this.cache.del(`user:${user.telegramId}`);
    return user;
  }

  /** 1-based rank among registered users sorted by points descending. */
  async getUserRank(userId: number): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { points: true },
    });
    if (!user) return 0;

    const above = await this.prisma.user.count({
      where: { registrationCompleted: true, points: { gt: user.points } },
    });
    return above + 1;
  }

  /** Top `take` registered users by points. Earlier joiners break ties. */
  async getLeaderboard(take = 20, skip = 0): Promise<LeaderboardEntry[]> {
    return this.prisma.user.findMany({
      where: { registrationCompleted: true },
      orderBy: [{ points: 'desc' }, { createdAt: 'asc' }],
      take,
      skip,
      select: {
        id: true,
        firstName: true,
        telegramUsername: true,
        points: true,
      },
    });
  }

  /** Number of users who completed registration using this user's referral link. */
  getCompletedReferralCount(userId: number): Promise<number> {
    return this.prisma.user.count({
      where: { referrerId: userId, registrationCompleted: true },
    });
  }
}
