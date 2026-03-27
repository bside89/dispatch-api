import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateLoginDto } from './dto/update-login.dto';
import { UserQueryDto } from './dto/user-query.dto';

describe('UserController', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockUserResponse = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'João Silva',
    email: 'joao.silva@email.com',
    createdAt: new Date('2024-01-01T12:00:00Z'),
    updatedAt: new Date('2024-01-01T12:00:00Z'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            updateLogin: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
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

    it('should create a user successfully with idempotency key', async () => {
      jest.spyOn(service, 'create').mockResolvedValue(mockUserResponse);

      const result = await controller.create(createUserDto, idempotencyKey);

      expect(service.create).toHaveBeenCalledWith(
        createUserDto,
        idempotencyKey,
      );
      expect(result).toEqual(mockUserResponse);
    });

    it('should throw BadRequestException when idempotency key is not provided', async () => {
      await expect(controller.create(createUserDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.create(createUserDto)).rejects.toThrow(
        'Idempotency-Key header is required',
      );

      expect(service.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    const queryDto: UserQueryDto = {
      name: 'João',
      limit: 10,
      offset: 0,
    };

    it('should return all users successfully', async () => {
      const expectedResult = [mockUserResponse];
      jest.spyOn(service, 'findAll').mockResolvedValue(expectedResult);

      const result = await controller.findAll(queryDto);

      expect(service.findAll).toHaveBeenCalledWith(queryDto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('findOne', () => {
    it('should return a user successfully', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockUserResponse);

      const result = await controller.findOne(mockUserResponse.id);

      expect(service.findOne).toHaveBeenCalledWith(mockUserResponse.id);
      expect(result).toEqual(mockUserResponse);
    });
  });

  describe('update', () => {
    const updateUserDto: UpdateUserDto = {
      name: 'João Santos',
      email: 'joao.santos@email.com',
    };

    it('should update a user successfully', async () => {
      const expectedResult = { ...mockUserResponse, ...updateUserDto };
      jest.spyOn(service, 'update').mockResolvedValue(expectedResult);

      const result = await controller.update(
        mockUserResponse.id,
        updateUserDto,
      );

      expect(service.update).toHaveBeenCalledWith(
        mockUserResponse.id,
        updateUserDto,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('updateLogin', () => {
    const updateLoginDto: UpdateLoginDto = {
      email: 'new.email@email.com',
      currentPassword: 'oldPassword123',
      newPassword: 'newPassword123',
    };

    it('should update login credentials successfully', async () => {
      const expectedResult = {
        ...mockUserResponse,
        email: updateLoginDto.email,
      };
      jest.spyOn(service, 'updateLogin').mockResolvedValue(expectedResult);

      const result = await controller.updateLogin(
        mockUserResponse.id,
        updateLoginDto,
      );

      expect(service.updateLogin).toHaveBeenCalledWith(
        mockUserResponse.id,
        updateLoginDto,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('remove', () => {
    it('should delete a user successfully', async () => {
      jest.spyOn(service, 'remove').mockResolvedValue();

      const result = await controller.remove(mockUserResponse.id);

      expect(service.remove).toHaveBeenCalledWith(mockUserResponse.id);
      expect(result).toBeUndefined();
    });
  });
});
