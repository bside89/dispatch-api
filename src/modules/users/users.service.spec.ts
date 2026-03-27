import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateLoginDto } from './dto/update-login.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { CacheService } from '../cache/cache.service';
import { UserRepository } from './repositories/user.repository';
import { HashUtils } from '@/shared/utils/hash.utils';
import { PaginatedResultDto } from '@/shared/dto/paginated-result.dto';

describe('UserService', () => {
  let service: UsersService;
  let userRepository: any;
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
    createEntity: jest.fn(),
    findOneWhere: jest.fn(),
    findById: jest.fn(),
    findAllWithFilters: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  });

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UserRepository,
          useFactory: mockUserRepositoryFactory,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepository = module.get(UserRepository);
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
      jest.spyOn(HashUtils, 'hash').mockResolvedValue('hashed_password123');
      jest.spyOn(cacheService, 'get').mockResolvedValue(null);
      jest.spyOn(userRepository, 'findOneWhere').mockResolvedValue(null);
      jest
        .spyOn(userRepository, 'createEntity')
        .mockReturnValue(mockUser as any);
      jest.spyOn(userRepository, 'save').mockResolvedValue(mockUser as any);
      jest.spyOn(cacheService, 'set').mockResolvedValue(undefined);

      const result = await service.create(createUserDto, idempotencyKey);

      expect(cacheService.get).toHaveBeenCalledWith(
        `user_idempotency:${idempotencyKey}`,
      );
      expect(userRepository.findOneWhere).toHaveBeenCalledWith({
        email: createUserDto.email,
      });
      expect(userRepository.createEntity).toHaveBeenCalledWith({
        name: createUserDto.name,
        email: createUserDto.email,
        password: expect.stringContaining('hashed_'),
      });
      expect(userRepository.save).toHaveBeenCalledWith(mockUser);
      expect(cacheService.set).toHaveBeenCalledWith(
        `user_idempotency:${idempotencyKey}`,
        mockUser,
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
      expect(userRepository.findOneWhere).not.toHaveBeenCalled();
      expect(userRepository.createEntity).not.toHaveBeenCalled();
      expect(userRepository.save).not.toHaveBeenCalled();
      expect(result).toEqual(cachedUser);
    });

    it('should throw ConflictException when email already exists', async () => {
      jest.spyOn(cacheService, 'get').mockResolvedValue(null);
      jest
        .spyOn(userRepository, 'findOneWhere')
        .mockResolvedValue(mockUser as any);

      await expect(
        service.create(createUserDto, idempotencyKey),
      ).rejects.toThrow(ConflictException);

      expect(cacheService.get).toHaveBeenCalledWith(
        `user_idempotency:${idempotencyKey}`,
      );
      expect(userRepository.findOneWhere).toHaveBeenCalledWith({
        email: createUserDto.email,
      });
    });
  });

  describe('findAll', () => {
    const queryDto: UserQueryDto = {
      name: 'João',
      limit: 10,
      page: 1,
    };

    it('should return all users successfully', async () => {
      const paginatedResult = new PaginatedResultDto(1, 1, 10, [
        mockUser as any,
      ]);
      jest
        .spyOn(userRepository, 'findAllWithFilters')
        .mockResolvedValue(paginatedResult);

      const result = await service.findAll(queryDto);

      expect(userRepository.findAllWithFilters).toHaveBeenCalledWith(queryDto);
      expect(result.data).toEqual([
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
      jest.spyOn(userRepository, 'findById').mockResolvedValue(mockUser as any);

      const result = await service.findOne(mockUser.id);

      expect(userRepository.findById).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual({
        id: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValue(null);

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
        .spyOn(userRepository, 'findById')
        .mockResolvedValueOnce(mockUser as any);
      jest.spyOn(userRepository, 'findOneWhere').mockResolvedValueOnce(null); // email not taken
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
      jest.spyOn(userRepository, 'findById').mockResolvedValue(null);

      await expect(
        service.update('nonexistent-id', updateUserDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when email already exists', async () => {
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

      jest
        .spyOn(userRepository, 'findById')
        .mockResolvedValueOnce(testMockUser as any);
      jest
        .spyOn(userRepository, 'findOneWhere')
        .mockResolvedValueOnce(anotherUser as any);
      const saveSpy = jest.spyOn(userRepository, 'save');

      await expect(
        service.update(testMockUser.id, updateUserDto),
      ).rejects.toThrow(ConflictException);

      expect(userRepository.findById).toHaveBeenCalledWith(testMockUser.id);
      expect(userRepository.findOneWhere).toHaveBeenCalledWith({
        email: updateUserDto.email,
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

      jest.spyOn(HashUtils, 'compare').mockResolvedValue(true);
      jest.spyOn(HashUtils, 'hash').mockResolvedValue('hashed_newPassword123');
      jest
        .spyOn(userRepository, 'findById')
        .mockResolvedValueOnce(userWithPassword as any);
      jest.spyOn(userRepository, 'findOneWhere').mockResolvedValueOnce(null); // email not taken
      jest.spyOn(userRepository, 'save').mockResolvedValue(updatedUser as any);

      const result = await service.updateLogin(mockUser.id, updateLoginDto);

      expect(result.email).toBe(updateLoginDto.email);
    });

    it('should throw NotFoundException when user not found', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValue(null);

      await expect(
        service.updateLogin('nonexistent-id', updateLoginDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when current password is required but not provided', async () => {
      const dto = { newPassword: 'newPassword123' };

      jest.spyOn(userRepository, 'findById').mockResolvedValue(mockUser as any);

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
