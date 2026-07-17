import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { I18nModule } from './i18n/i18n.module';
import { PrismaModule } from './prisma/prisma.module';
import { MainMenuModule } from './main-menu/main-menu.module';
import { RegistrationModule } from './registration/registration.module';
import { TelegramModule } from './telegram/telegram.module';
import { UsersModule } from './users/users.module';
import { StoryModule } from './story/story.module';
import { InstagramModule } from './instagram/instagram.module';
import { AdminModule } from './admin/admin.module';
import { BotChatModule } from './bot-chat/bot-chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      ignoreEnvFile: process.env.NODE_ENV === 'production',
    }),
    I18nModule,
    PrismaModule,
    TelegramModule,
    UsersModule,
    RegistrationModule,
    MainMenuModule,
    StoryModule,
    InstagramModule,
    AdminModule,
    BotChatModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
