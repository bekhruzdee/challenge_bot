import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

export interface LeaderboardEntry {
  id: number;
  firstName: string | null;
  telegramUsername: string | null;
  points: number;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByTelegramId(telegramId: bigint): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { telegramId } });
  }

  findById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  create(dto: CreateUserDto): Promise<User> {
    return this.prisma.user.create({ data: dto });
  }

  update(id: number, dto: UpdateUserDto): Promise<User> {
    return this.prisma.user.update({ where: { id }, data: dto });
  }

  async existsByTelegramId(telegramId: bigint): Promise<boolean> {
    const hit = await this.prisma.user.findUnique({
      where: { telegramId },
      select: { id: true },
    });
    return hit !== null;
  }

  addPoints(id: number, amount: number): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { points: { increment: amount } },
    });
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
  async getLeaderboard(take = 10): Promise<LeaderboardEntry[]> {
    return this.prisma.user.findMany({
      where: { registrationCompleted: true },
      orderBy: [{ points: 'desc' }, { createdAt: 'asc' }],
      take,
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
