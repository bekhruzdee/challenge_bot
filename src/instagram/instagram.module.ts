import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { InstagramService } from './instagram.service';

@Module({
  imports: [PrismaModule],
  providers: [InstagramService],
  exports: [InstagramService],
})
export class InstagramModule {}
