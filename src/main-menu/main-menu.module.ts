import { Module } from '@nestjs/common';
import { LocationModule } from '../location/location.module';
import { TelegramModule } from '../telegram/telegram.module';
import { UsersModule } from '../users/users.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { MainMenuUpdate } from './main-menu.update';

@Module({
  imports: [TelegramModule, LocationModule, UsersModule, SubscriptionModule],
  providers: [MainMenuUpdate],
})
export class MainMenuModule {}
