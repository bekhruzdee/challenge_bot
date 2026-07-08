import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { LocationService } from './location.service';

@Module({
  imports: [UsersModule],
  providers: [LocationService],
  exports: [LocationService],
})
export class LocationModule {}
