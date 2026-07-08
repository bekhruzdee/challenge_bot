export class CreateUserDto {
  telegramId: bigint;
  telegramUsername?: string;
  firstName?: string;
  lastName?: string;
  referrerId?: number;
}
