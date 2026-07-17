import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { LeaderboardEntry, UsersService } from '../users/users.service';

const USERS_PER_PAGE = 10;

export interface AdminStats {
  totalUsers: number;
  activeToday: number;
  totalDistance: number;
  totalSteps: number;
  totalPoints: number;
}

export interface UsersPage {
  users: {
    id: number;
    firstName: string | null;
    telegramUsername: string | null;
    points: number;
  }[];
  total: number;
  page: number;
  totalPages: number;
}

@Injectable()
export class AdminService {
  private readonly adminIds: Set<bigint>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    configService: ConfigService,
  ) {
    const raw = configService.get<string>('ADMIN_IDS', '');
    this.adminIds = new Set(
      raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map(BigInt),
    );
  }

  isAdmin(telegramId: bigint): boolean {
    return this.adminIds.has(telegramId);
  }

  countUsers(): Promise<number> {
    return this.prisma.user.count({ where: { registrationCompleted: true } });
  }

  async getUsers(page: number): Promise<UsersPage> {
    const skip = (page - 1) * USERS_PER_PAGE;
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { registrationCompleted: true },
        orderBy: { createdAt: 'asc' },
        skip,
        take: USERS_PER_PAGE,
        select: {
          id: true,
          firstName: true,
          telegramUsername: true,
          points: true,
        },
      }),
      this.countUsers(),
    ]);

    return {
      users,
      total,
      page,
      totalPages: Math.ceil(total / USERS_PER_PAGE),
    };
  }

  async getStats(): Promise<AdminStats> {
    const today = this.todayUtc();

    const [totalUsers, activeToday, distanceAgg, pointsAgg] = await Promise.all(
      [
        this.prisma.user.count({ where: { registrationCompleted: true } }),
        this.prisma.progress.count({
          where: { date: today, totalSteps: { gt: 0 } },
        }),
        this.prisma.progress.aggregate({
          _sum: { totalMeters: true, totalSteps: true },
        }),
        this.prisma.user.aggregate({
          _sum: { points: true },
          where: { registrationCompleted: true },
        }),
      ],
    );

    return {
      totalUsers,
      activeToday,
      totalDistance: distanceAgg._sum.totalMeters ?? 0,
      totalSteps: distanceAgg._sum.totalSteps ?? 0,
      totalPoints: pointsAgg._sum.points ?? 0,
    };
  }

  getAllActiveUsers(): Promise<{ telegramId: bigint }[]> {
    return this.prisma.user.findMany({
      where: { registrationCompleted: true },
      select: { telegramId: true },
    });
  }

  getLeaderboard(take = 20): Promise<LeaderboardEntry[]> {
    return this.usersService.getLeaderboard(take);
  }

  private todayUtc(): Date {
    const n = new Date();
    return new Date(
      Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()),
    );
  }
}
