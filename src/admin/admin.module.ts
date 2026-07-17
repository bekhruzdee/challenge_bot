import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { TelegramModule } from '../telegram/telegram.module';
import { UsersModule } from '../users/users.module';
import { StoryModule } from '../story/story.module';
import { InstagramModule } from '../instagram/instagram.module';
import { RegistrationModule } from '../registration/registration.module';
import { AdminService } from './admin.service';
import { AdminUpdate } from './admin.update';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    TelegramModule,
    UsersModule,
    StoryModule,
    InstagramModule,
    RegistrationModule,
  ],
  providers: [AdminService, AdminUpdate],
  exports: [AdminService],
})
export class AdminModule {}
