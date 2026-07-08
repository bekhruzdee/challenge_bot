import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

const mockUser = {
  id: 1,
  telegramId: BigInt('123456789'),
  telegramUsername: 'testuser',
  firstName: 'Test',
  lastName: 'User',
  phone: null,
  region: null,
  points: 0,
  registrationCompleted: false,
  referrerId: null,
  storyBonusGiven: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByTelegramId', () => {
    it('returns the user when found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByTelegramId(BigInt('123456789'));

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { telegramId: BigInt('123456789') },
      });
      expect(result).toEqual(mockUser);
    });

    it('returns null when not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.findByTelegramId(BigInt('999'));

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('returns the user when found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findById(1);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(result).toEqual(mockUser);
    });

    it('returns null when not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('creates and returns the new user', async () => {
      const dto: CreateUserDto = {
        telegramId: BigInt('123456789'),
        telegramUsername: 'testuser',
        firstName: 'Test',
        lastName: 'User',
      };
      mockPrismaService.user.create.mockResolvedValue(mockUser);

      const result = await service.create(dto);

      expect(mockPrismaService.user.create).toHaveBeenCalledWith({ data: dto });
      expect(result).toEqual(mockUser);
    });
  });

  describe('update', () => {
    it('updates and returns the user', async () => {
      const dto: UpdateUserDto = { phone: '+998901234567', region: 'Toshkent' };
      const updated = { ...mockUser, ...dto };
      mockPrismaService.user.update.mockResolvedValue(updated);

      const result = await service.update(1, dto);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: dto,
      });
      expect(result).toEqual(updated);
    });
  });

  describe('existsByTelegramId', () => {
    it('returns true when the user exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 1 });

      const result = await service.existsByTelegramId(BigInt('123456789'));

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { telegramId: BigInt('123456789') },
        select: { id: true },
      });
      expect(result).toBe(true);
    });

    it('returns false when the user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.existsByTelegramId(BigInt('999'));

      expect(result).toBe(false);
    });
  });
});
