import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { MainMenuModule } from './main-menu/main-menu.module';
import { RegistrationModule } from './registration/registration.module';
import { TelegramModule } from './telegram/telegram.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    PrismaModule,
    TelegramModule,
    UsersModule,
    RegistrationModule,
    MainMenuModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
