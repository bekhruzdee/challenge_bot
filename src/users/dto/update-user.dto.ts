import { Language } from '@prisma/client';

export class UpdateUserDto {
  telegramUsername?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  region?: string;
  points?: number;
  isActive?: boolean;
  registrationCompleted?: boolean;
  storyBonusGiven?: boolean;
  language?: Language;
  lastActivityAt?: Date;
}
