import { Module } from '@nestjs/common';
import { LocationModule } from '../location/location.module';
import { TelegramModule } from '../telegram/telegram.module';
import { MainMenuUpdate } from './main-menu.update';

@Module({
  imports: [TelegramModule, LocationModule],
  providers: [MainMenuUpdate],
})
export class MainMenuModule {}
