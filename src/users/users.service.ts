import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

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
}
