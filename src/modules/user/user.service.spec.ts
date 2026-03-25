import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateLoginDto } from './dto/update-login.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { CacheService } from '../cache/cache.service';
import { AuthService } from '../auth/auth.service';

describe('UserService', () => {
  let service: UserService;
  let userRepository: Repository<User>;
  let cacheService: CacheService;

  const mockUser = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'João Silva',
    email: 'joao.silva@email.com',
    password: 'hashedPassword123',
    createdAt: new Date(),
    updatedAt: new Date(),
    orders: [], // Add orders field
  };

  const mockUserRepositoryFactory = () => ({
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      andWhere: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    })),
  });

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useFactory: mockUserRepositoryFactory,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: AuthService,
          useValue: {
            hashPasswordOrToken: jest.fn().mockImplementation((v) => Promise.resolve(`hashed_${v}`)),
            verifyPasswordOrToken: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    cacheService = module.get<CacheService>(CacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createUserDto: CreateUserDto = {
      name: 'João Silva',
      email: 'joao.silva@email.com',
      password: 'password123',
    };
    const idempotencyKey = 'test-idempotency-key-123';

    it('should create a user successfully when no idempotency key exists in cache', async () => {
      jest.spyOn(cacheService, 'get').mockResolvedValue(null);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(userRepository, 'create').mockReturnValue(mockUser as any);
      jest.spyOn(userRepository, 'save').mockResolvedValue(mockUser as any);
      jest.spyOn(cacheService, 'set').mockResolvedValue(undefined);

      const result = await service.create(createUserDto, idempotencyKey);

      expect(cacheService.get).toHaveBeenCalledWith(
        `user_idempotency:${idempotencyKey}`,
      );
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: createUserDto.email },
      });
      // Password is hashed by AuthService before being passed to repository.create
      expect(userRepository.create).toHaveBeenCalledWith({
        name: createUserDto.name,
        email: createUserDto.email,
        password: expect.stringContaining('hashed_'),
      });
      expect(userRepository.save).toHaveBeenCalledWith(mockUser);
      expect(cacheService.set).toHaveBeenCalledWith(
        `user_idempotency:${idempotencyKey}`,
        {
          id: mockUser.id,
          name: mockUser.name,
          email: mockUser.email,
          createdAt: mockUser.createdAt,
          updatedAt: mockUser.updatedAt,
        },
        86400000,
      );
      expect(result).toEqual({
        id: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
    });

    it('should return existing user when idempotency key exists in cache', async () => {
      const cachedUser = {
        id: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      };
      jest.spyOn(cacheService, 'get').mockResolvedValue(cachedUser);

      const result = await service.create(createUserDto, idempotencyKey);

      expect(cacheService.get).toHaveBeenCalledWith(
        `user_idempotency:${idempotencyKey}`,
      );
      expect(userRepository.findOne).not.toHaveBeenCalled();
      expect(userRepository.create).not.toHaveBeenCalled();
      expect(userRepository.save).not.toHaveBeenCalled();
      expect(result).toEqual(cachedUser);
    });

    it('should throw ConflictException when email already exists', async () => {
      jest.spyOn(cacheService, 'get').mockResolvedValue(null);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as any);

      await expect(
        service.create(createUserDto, idempotencyKey),
      ).rejects.toThrow(ConflictException);

      expect(cacheService.get).toHaveBeenCalledWith(
        `user_idempotency:${idempotencyKey}`,
      );
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: createUserDto.email },
      });
    });
  });

  describe('findAll', () => {
    const queryDto: UserQueryDto = {
      name: 'João',
      limit: 10,
      offset: 0,
    };

    it('should return all users successfully', async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockUser]),
      };

      jest
        .spyOn(userRepository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      const result = await service.findAll(queryDto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'user.name ILIKE :name',
        {
          name: '%João%',
        },
      );
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(10);
      expect(result).toEqual([
        {
          id: mockUser.id,
          name: mockUser.name,
          email: mockUser.email,
          createdAt: mockUser.createdAt,
          updatedAt: mockUser.updatedAt,
        },
      ]);
    });
  });

  describe('findOne', () => {
    it('should return a user successfully', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as any);

      const result = await service.findOne(mockUser.id);

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUser.id },
      });
      expect(result).toEqual({
        id: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    const updateUserDto: UpdateUserDto = {
      name: 'João Santos',
      email: 'joao.santos@email.com',
    };

    it('should update a user successfully', async () => {
      const updatedUser = { ...mockUser, ...updateUserDto };
      jest
        .spyOn(userRepository, 'findOne')
        .mockResolvedValueOnce(mockUser as any) // First call to find user
        .mockResolvedValueOnce(null); // Second call to check email uniqueness
      jest.spyOn(userRepository, 'save').mockResolvedValue(updatedUser as any);

      const result = await service.update(mockUser.id, updateUserDto);

      expect(userRepository.save).toHaveBeenCalledWith({
        ...mockUser,
        ...updateUserDto,
      });
      expect(result.name).toBe(updateUserDto.name);
      expect(result.email).toBe(updateUserDto.email);
    });

    it('should throw NotFoundException when user not found', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.update('nonexistent-id', updateUserDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when email already exists', async () => {
      // Create fresh mock objects for this test to avoid contamination
      const testMockUser = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'João Silva',
        email: 'joao.silva@email.com',
        password: 'hashedPassword123',
        createdAt: new Date(),
        updatedAt: new Date(),
        orders: [],
      };

      const anotherUser = {
        id: 'another-id',
        name: 'Another User',
        email: 'joao.santos@email.com',
        password: 'hashedPassword456',
        createdAt: new Date(),
        updatedAt: new Date(),
        orders: [],
      };

      const findOneSpy = jest.spyOn(userRepository, 'findOne');

      // Set up the call sequence
      findOneSpy
        .mockResolvedValueOnce(testMockUser as any) // First call to find user to update
        .mockResolvedValueOnce(anotherUser as any); // Second call to check email uniqueness

      // Mock save should not be called
      const saveSpy = jest.spyOn(userRepository, 'save');

      await expect(
        service.update(testMockUser.id, updateUserDto),
      ).rejects.toThrow(ConflictException);

      // Verify the right calls were made
      expect(findOneSpy).toHaveBeenCalledTimes(2);
      expect(findOneSpy).toHaveBeenNthCalledWith(1, {
        where: { id: testMockUser.id },
      });
      expect(findOneSpy).toHaveBeenNthCalledWith(2, {
        where: { email: updateUserDto.email },
      });
      expect(saveSpy).not.toHaveBeenCalled();
    });
  });

  describe('updateLogin', () => {
    const updateLoginDto: UpdateLoginDto = {
      email: 'new.email@email.com',
      currentPassword: 'hashedPassword123',
      newPassword: 'newPassword123',
    };

    it('should update login credentials successfully', async () => {
      const userWithPassword = {
        ...mockUser,
        password: 'hashedPassword123',
      };
      const updatedUser = { ...userWithPassword, ...updateLoginDto };

      jest
        .spyOn(userRepository, 'findOne')
        .mockResolvedValueOnce(userWithPassword as any) // First call to find user with password
        .mockResolvedValueOnce(null); // Second call to check email uniqueness
      jest.spyOn(userRepository, 'save').mockResolvedValue(updatedUser as any);

      const result = await service.updateLogin(mockUser.id, updateLoginDto);

      expect(result.email).toBe(updateLoginDto.email);
    });

    it('should throw NotFoundException when user not found', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.updateLogin('nonexistent-id', updateLoginDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when current password is required but not provided', async () => {
      const dto = { newPassword: 'newPassword123' };

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as any);

      await expect(service.updateLogin(mockUser.id, dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('remove', () => {
    it('should delete a user successfully', async () => {
      jest
        .spyOn(userRepository, 'delete')
        .mockResolvedValue({ affected: 1, raw: {} });

      await service.remove(mockUser.id);

      expect(userRepository.delete).toHaveBeenCalledWith(mockUser.id);
    });

    it('should throw NotFoundException when user not found', async () => {
      jest
        .spyOn(userRepository, 'delete')
        .mockResolvedValue({ affected: 0, raw: {} });

      await expect(service.remove('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
