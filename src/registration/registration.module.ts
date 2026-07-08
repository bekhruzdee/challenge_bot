import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { TelegramModule } from '../telegram/telegram.module';
import { UsersModule } from '../users/users.module';
import { RegistrationService } from './registration.service';
import { RegistrationUpdate } from './registration.update';

@Module({
  imports: [ConfigModule, PrismaModule, TelegramModule, UsersModule],
  providers: [RegistrationService, RegistrationUpdate],
})
export class RegistrationModule {}
