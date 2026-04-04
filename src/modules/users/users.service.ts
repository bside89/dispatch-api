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
import { EntityMapper } from '@/shared/utils/entity-mapper';
import { HashUtils } from '@/shared/utils/hash.utils';
import { DataSource } from 'typeorm';
import { Transactional } from '@/shared/decorators/transactional.decorator';
import { CACHE_CONFIG } from '@/shared/constants/cache.constant';
import { runAndIgnoreError } from '@/shared/helpers/functions';
import { UseLock } from '@/shared/decorators/lock.decorator';
import Redlock from 'redlock';
import { CacheableService } from '@/shared/services/cacheable.service';

@Injectable()
export class UsersService extends CacheableService {
  constructor(
    private readonly userRepository: UserRepository,
    protected readonly cacheService: CacheService,
    protected readonly dataSource: DataSource, // Used in @Transactional()
    protected readonly redlock: Redlock, // Used in @UseLock()
  ) {
    super(UsersService.name, cacheService);
  }

  @Transactional()
  @UseLock({
    prefix: 'user-create',
    key: ([, idempotencyKey]) => idempotencyKey,
  })
  async create(
    dto: CreateUserDto,
    idempotencyKey: string,
  ): Promise<UserResponseDto> {
    const idempotencyKeyFormatted = `idempotency:user:create:${idempotencyKey}`;

    // Check if there's an existing user for the same idempotency key
    const existingUser = await this.cacheService.get<UserResponseDto>(
      idempotencyKeyFormatted,
    );
    if (existingUser) {
      this.logger.debug('Returning existing user for idempotency key', {
        idempotencyKey,
        userId: existingUser.id,
      });
      return existingUser;
    }

    const emailExists = await this.userRepository.existsBy({
      email: dto.email,
    });
    if (emailExists) {
      throw new ConflictException('Email already exists');
    }

    this.logger.debug('Creating new user', { idempotencyKey });

    const user = this.userRepository.createEntity({
      name: dto.name,
      email: dto.email,
      password: await HashUtils.hash(dto.password),
    });

    const savedUser = await this.userRepository.save(user);

    const userMapped = EntityMapper.map(savedUser, UserResponseDto);

    await this.cacheService.set(
      idempotencyKeyFormatted,
      userMapped,
      CACHE_CONFIG.IDEMPOTENCY_TTL,
    );

    this.logger.debug('User created and cached', {
      idempotencyKey,
      userId: savedUser.id,
    });

    await this.invalidateCache({
      patternsToDelete: ['cache:user:find-all:*'],
    });

    return userMapped;
  }

  async findAll(query: UserQueryDto): Promise<PaginatedResultDto<UserResponseDto>> {
    const cacheKey = `cache:user:find-all:${JSON.stringify(query)}`;

    const cachedResult = await runAndIgnoreError(
      () => this.cacheService.get<PaginatedResultDto<UserResponseDto>>(cacheKey),
      `fetching users list from cache with key: ${cacheKey}`,
    );
    if (cachedResult) {
      this.logger.debug('Returning cached users list', { cacheKey });
      return cachedResult;
    }

    const result = await this.userRepository.findAllWithFilters(query);

    await runAndIgnoreError(
      () => this.cacheService.set(cacheKey, result, CACHE_CONFIG.LIST_TTL),
      `caching users list with key: ${cacheKey}`,
    );

    this.logger.debug(`Retrieved ${result.data.length} users`);

    return {
      ...result,
      data: EntityMapper.mapArray(result.data, UserResponseDto),
    };
  }

  async findOne(id: string): Promise<UserResponseDto> {
    const cacheKey = `cache:user:find-one:${id}`;

    const cachedResult = await runAndIgnoreError(
      () => this.cacheService.get<UserResponseDto>(cacheKey),
      `fetching user from cache with key: ${cacheKey}`,
    );
    if (cachedResult) {
      this.logger.debug('Returning cached user', { id });
      return cachedResult;
    }

    this.logger.debug('Retrieving user', { id });

    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    this.logger.debug('User found', { email: user.email });

    const userMapped = EntityMapper.map(user, UserResponseDto);

    await runAndIgnoreError(
      () =>
        this.cacheService.set(
          `cache:user:find-one:${id}`,
          userMapped,
          CACHE_CONFIG.LIST_TTL,
        ),
      `caching user with ID: ${id}`,
    );

    return userMapped;
  }

  async findByEmail(email: string): Promise<UserResponseDto> {
    const cacheKey = `cache:user:find-by-email:${email}`;

    const cachedResult = await runAndIgnoreError(
      () => this.cacheService.get<UserResponseDto>(cacheKey),
      `fetching user from cache with key: ${cacheKey}`,
    );
    if (cachedResult) {
      this.logger.debug('Returning cached user', { email });
      return cachedResult;
    }

    this.logger.debug('Finding user by email', { email });

    const user = await this.userRepository.findOneWhere({ email });
    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }

    this.logger.debug('User found', { email });

    const userMapped = EntityMapper.map(user, UserResponseDto);

    await runAndIgnoreError(
      () =>
        this.cacheService.set(
          `cache:user:find-by-email:${email}`,
          userMapped,
          CACHE_CONFIG.LIST_TTL,
        ),
      `caching user with email: ${email}`,
    );

    return userMapped;
  }

  @UseLock({ prefix: 'user-update', key: ([id]) => id })
  async update(id: string, updateUserDto: UpdateUserDto): Promise<UserResponseDto> {
    this.logger.debug(`Updating user with ID: ${id}`);

    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Check if email already exists (if email is being updated)
    const oldEmail = user.email;
    const newEmail = updateUserDto.email;
    if (newEmail && newEmail !== oldEmail) {
      const emailExists = await this.userRepository.existsBy({
        email: newEmail,
      });
      if (emailExists) {
        throw new ConflictException('Email already exists');
      }
    }

    // This will only update the fields that are present in updateUserDto
    Object.assign(user, updateUserDto);

    const updatedUser = await this.userRepository.save(user);

    this.logger.debug(`User updated successfully: ${updatedUser.id}`);

    await this.invalidateCache({
      keysToDelete: [
        `cache:user:find-one:${updatedUser.id}`,
        `cache:user:find-by-email:${updatedUser.email}`,
      ],
      patternsToDelete: ['cache:user:find-all:*'],
    });

    return EntityMapper.map(updatedUser, UserResponseDto);
  }

  @UseLock({ prefix: 'user-update', key: ([id]) => id })
  async updateLogin(
    id: string,
    updateLoginDto: UpdateLoginDto,
  ): Promise<UserResponseDto> {
    this.logger.debug('Updating login for user', { userId: id });

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
        !(await HashUtils.compare(user.password, updateLoginDto.currentPassword))
      ) {
        throw new BadRequestException('Current password is incorrect');
      }
      user.password = await HashUtils.hash(updateLoginDto.newPassword);
    }

    if (updateLoginDto.email && updateLoginDto.email !== user.email) {
      const emailExists = await this.userRepository.existsBy({
        email: updateLoginDto.email,
      });
      if (emailExists) {
        throw new ConflictException('Email already exists');
      }
      user.email = updateLoginDto.email;
    }

    const updatedUser = await this.userRepository.save(user);

    const userMapped = EntityMapper.map(updatedUser, UserResponseDto);

    await this.invalidateCache({
      keysToDelete: [
        `cache:user:find-one:${updatedUser.id}`,
        `cache:user:find-by-email:${updatedUser.email}`,
      ],
      patternsToDelete: ['cache:user:find-all:*'],
    });

    this.logger.debug('Login updated successfully for user', {
      userEmail: userMapped.email,
    });

    return userMapped;
  }

  @UseLock({ prefix: 'user-delete', key: ([id]) => id })
  async remove(id: string): Promise<void> {
    this.logger.debug('Deleting user', { id });

    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    await this.userRepository.delete(id);

    this.logger.debug('User deleted successfully', { userId: id });

    await this.invalidateCache({
      keysToDelete: [
        `cache:user:find-one:${id}`,
        `cache:user:find-by-email:${user.email}`,
      ],
      patternsToDelete: ['cache:user:find-all:*'],
    });
  }
}
