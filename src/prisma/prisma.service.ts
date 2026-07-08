import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connectionString = process.env.DATABASE_URL || '';

    const adapter = new PrismaPg({
      connectionString: connectionString,
    });

    super({ adapter });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      console.log('Prisma connected successfully with PostgreSQL adapter');
    } catch (error) {
      console.error('Error connecting Prisma:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('Prisma disconnected');
  }
}
