import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateLoginDto } from './dto/update-login.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { UserRepository } from './repositories/user.repository';
import { PaginatedResultDto } from '@/shared/dto/paginated-result.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { HashUtils } from '@/shared/utils/hash.utils';
import { BaseService } from '@/shared/services/base.service';
import { DataSource } from 'typeorm';
import { Transactional } from '@/shared/decorators/transactional.decorator';
import { CACHE_CONFIG } from '@/shared/constants/cache.constant';

@Injectable()
export class UsersService extends BaseService {
  private readonly IDEMPOTENCY_PREFIX = 'user-idempotency';
  private readonly CACHE_PREFIX = 'user';

  constructor(
    private readonly cacheService: CacheService,
    private readonly userRepository: UserRepository,
    protected readonly dataSource: DataSource,
  ) {
    super(dataSource, UsersService.name);
  }

  @Transactional()
  async create(
    createUserDto: CreateUserDto,
    idempotencyKey: string,
  ): Promise<UserResponseDto> {
    const idempotencyKeyFormatted = `${this.IDEMPOTENCY_PREFIX}:${idempotencyKey}`;
    const existingUser = await this.runAndIgnoreError(
      () => this.cacheService.get<UserResponseDto>(idempotencyKeyFormatted),
      'create - cache retrieval',
    );
    if (existingUser) {
      this.logger.debug(
        `Returning existing user for idempotency key: ${idempotencyKey}, User ID: ${existingUser.id}`,
      );
      return existingUser;
    }

    const existingEmailUser = await this.userRepository.findOneWhere({
      email: createUserDto.email,
    });
    if (existingEmailUser) {
      throw new ConflictException('Email already exists');
    }

    this.logger.debug(
      `Creating new user with idempotency key: ${idempotencyKey}`,
    );

    const user = this.userRepository.createEntity({
      name: createUserDto.name,
      email: createUserDto.email,
      password: await HashUtils.hash(createUserDto.password),
    });

    const savedUser = await this.userRepository.save(user);

    const userMapped = UserResponseDto.fromEntity(savedUser);

    await this.cacheService.set(
      idempotencyKeyFormatted,
      userMapped,
      CACHE_CONFIG.IDEMPOTENCY_TTL,
    );

    this.logger.debug(
      `User created and cached with idempotency key: ${idempotencyKey}, User ID: ${savedUser.id}`,
    );

    return userMapped;
  }

  async findAll(
    query: UserQueryDto,
  ): Promise<PaginatedResultDto<UserResponseDto>> {
    const cacheKey = `${this.CACHE_PREFIX}:list:${JSON.stringify(query)}`;
    const cachedResult = await this.runAndIgnoreError(
      () =>
        this.cacheService.get<PaginatedResultDto<UserResponseDto>>(cacheKey),
      `fetching users list from cache with key: ${cacheKey}`,
    );
    if (cachedResult) {
      this.logger.debug(`Returning cached users list`);
      return cachedResult;
    }

    const result = await this.userRepository.findAllWithFilters(query);

    await this.runAndIgnoreError(
      () => this.cacheService.set(cacheKey, result, CACHE_CONFIG.LIST_TTL),
      `caching users list with key: ${cacheKey}`,
    );

    this.logger.debug(`Retrieved ${result.data.length} users`);

    return {
      ...result,
      data: result.data.map(UserResponseDto.fromEntity),
    };
  }

  async findOne(id: string): Promise<UserResponseDto> {
    this.logger.debug(`Retrieving user with ID: ${id}`);

    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    this.logger.debug(`User found: ${user.email}`);

    return UserResponseDto.fromEntity(user);
  }

  async findByEmail(email: string): Promise<UserResponseDto> {
    this.logger.debug(`Finding user by email: ${email}`);

    const user = await this.userRepository.findOneWhere({ email });
    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }

    this.logger.debug(`User found with email: ${email}`);

    return UserResponseDto.fromEntity(user);
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    this.logger.debug(`Updating user with ID: ${id}`);

    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Check if email already exists (if email is being updated)
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.userRepository.findOneWhere({
        email: updateUserDto.email,
      });

      if (existingUser) {
        throw new ConflictException('Email already exists');
      }
    }

    Object.assign(user, updateUserDto);
    const updatedUser = await this.userRepository.save(user);

    this.logger.debug(`User updated successfully: ${updatedUser.email}`);

    return UserResponseDto.fromEntity(updatedUser);
  }

  async updateLogin(
    id: string,
    updateLoginDto: UpdateLoginDto,
  ): Promise<UserResponseDto> {
    this.logger.debug(`Updating login for user with ID: ${id}`);

    const user = await this.userRepository.findById(id, [
      'id',
      'name',
      'email',
      'password',
      'createdAt',
      'updatedAt',
    ]);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Validate current password if new password is provided
    if (updateLoginDto.newPassword) {
      if (!updateLoginDto.currentPassword) {
        throw new BadRequestException(
          'Current password is required to change password',
        );
      }

      // Verify current password
      if (
        !(await HashUtils.compare(
          user.password,
          updateLoginDto.currentPassword,
        ))
      ) {
        throw new BadRequestException('Current password is incorrect');
      }
      user.password = await HashUtils.hash(updateLoginDto.newPassword);
    }

    if (updateLoginDto.email && updateLoginDto.email !== user.email) {
      const existingUser = await this.userRepository.findOneWhere({
        email: updateLoginDto.email,
      });
      if (existingUser) {
        throw new ConflictException('Email already exists');
      }
      user.email = updateLoginDto.email;
    }

    const updatedUser = await this.userRepository.save(user);

    const userMapped = UserResponseDto.fromEntity(updatedUser);

    this.logger.debug(
      `Login updated successfully for user: ${userMapped.email}`,
    );

    return userMapped;
  }

  async remove(id: string): Promise<void> {
    this.logger.debug(`Deleting user with ID: ${id}`);

    const result = await this.userRepository.delete(id);

    if (result.affected === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    this.logger.debug(`User with ID ${id} deleted successfully`);
  }
}
