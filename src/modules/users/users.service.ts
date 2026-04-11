import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { CacheService } from '../../shared/modules/cache/cache.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateLoginDto } from './dto/update-login.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { UserRepository } from './repositories/user.repository';
import { PaginatedResultDto } from '@/shared/dto/paginated-result.dto';
import { UserAddressResponseDto, UserResponseDto } from './dto/user-response.dto';
import { EntityMapper } from '@/shared/utils/entity-mapper';
import { HashUtils } from '@/shared/utils/hash.utils';
import { DataSource } from 'typeorm';
import { Transactional } from '@/shared/decorators/transactional.decorator';
import { CACHE_TTL } from '@/shared/constants/cache-ttl.constant';
import { ensureError, runAndIgnoreError } from '@/shared/helpers/functions';
import { UseLock } from '@/shared/decorators/lock.decorator';
import Redlock from 'redlock';
import { BaseService } from '@/shared/services/base.service';
import { USER_KEY } from '../../shared/modules/cache/constants/user.key';
import { OutboxService } from '@/shared/modules/outbox/outbox.service';
import { OutboxType } from '@/shared/modules/outbox/enums/outbox-type.enum';
import {
  CreateCustomerJobPayload,
  DeleteCustomerJobPayload,
  UpdateCustomerJobPayload,
} from '@/shared/payloads/payment-job.payload';
import type { RequestUser } from '../auth/interfaces/request-user.interface';
import { UserRole } from './enums/user-role.enum';
import { PaymentsGatewayService } from '../payments-gateway/payments-gateway.service';
import { CustomerResponseDto } from '../payments-gateway/dto/customer-response.dto';

@Injectable()
export class UsersService extends BaseService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly paymentsGatewayService: PaymentsGatewayService,
    protected readonly cacheService: CacheService,
    protected readonly outboxService: OutboxService,
    protected readonly dataSource: DataSource, // Used in @Transactional()
    protected readonly redlock: Redlock, // Used in @UseLock()
  ) {
    super(UsersService.name);
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
    const idempotencyKeyFormatted = USER_KEY.IDEMPOTENCY(
      this.create.name,
      idempotencyKey,
    );

    // Check if there's an existing user for the same idempotency key
    const existingUser = await this.cacheService.get<UserResponseDto>(
      idempotencyKeyFormatted,
    );
    if (existingUser) {
      this.logger.debug('Returning existing user for idempotency key', {
        idempotencyKey: idempotencyKeyFormatted,
        userId: existingUser.id,
      });
      return existingUser;
    }

    const emailExists = await this.userRepository.existsBy({
      where: { email: dto.email },
    });
    if (emailExists) {
      throw new ConflictException('Email already exists');
    }

    this.logger.debug('Creating new user', {
      idempotencyKey: idempotencyKeyFormatted,
    });

    const user = this.userRepository.createEntity({
      name: dto.name,
      email: dto.email,
      password: await HashUtils.hash(dto.password),
    });

    const savedUser = await this.userRepository.save(user);

    const userMapped = EntityMapper.map(savedUser, UserResponseDto);

    // Add outbox message for creating Stripe customer (job)
    await this.outboxService.add(
      OutboxType.PAYMENT_CREATE_CUSTOMER,
      new CreateCustomerJobPayload(
        savedUser.id,
        savedUser.name,
        savedUser.email,
        dto.address,
      ),
    );

    await this.cacheService.set(
      idempotencyKeyFormatted,
      userMapped,
      CACHE_TTL.IDEMPOTENCY,
    );

    this.logger.debug('User created and cached', {
      idempotencyKey: idempotencyKeyFormatted,
      userId: savedUser.id,
    });

    await this.cacheService.deleteBulk({
      patterns: [USER_KEY.CACHE_FIND_ALL_PATTERN()],
    });

    return userMapped;
  }

  async findAll(
    query: UserQueryDto,
    requestUser?: RequestUser,
  ): Promise<PaginatedResultDto<UserResponseDto>> {
    if (requestUser?.jwtPayload?.role !== UserRole.ADMIN) {
      return this.findOwnUserList(query, requestUser);
    }

    const cacheKey = USER_KEY.CACHE_FIND_ALL(query);

    const cachedResult = await runAndIgnoreError(
      () => this.cacheService.get<PaginatedResultDto<UserResponseDto>>(cacheKey),
      `fetching users list from cache with key: ${cacheKey}`,
      this.logger,
    );
    if (cachedResult) {
      this.logger.debug('Returning cached users list', { cacheKey });
      return cachedResult;
    }

    const result = await this.userRepository.filter(query);

    const resultMapped = new PaginatedResultDto<UserResponseDto>(
      result.total,
      result.page,
      result.limit,
      EntityMapper.mapArray(result.data, UserResponseDto),
    );

    await runAndIgnoreError(
      () => this.cacheService.set(cacheKey, resultMapped, CACHE_TTL.LIST),
      `caching users list with key: ${cacheKey}`,
      this.logger,
    );

    this.logger.debug(`Retrieved ${result.data.length} users`, { cacheKey });

    return resultMapped;
  }

  async findOne(id: string, requestUser?: RequestUser): Promise<UserResponseDto> {
    this.assertUserAccess(id, requestUser);

    const cacheKey = USER_KEY.CACHE_FIND_ONE(id);

    const cachedResult = await runAndIgnoreError(
      () => this.cacheService.get<UserResponseDto>(cacheKey),
      `fetching user from cache with key: ${cacheKey}`,
      this.logger,
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

    this.logger.debug('User found', { id: user.id });

    const customer = await this.ensureCustomersRetrieve(user.id, user.customerId);

    this.logger.debug('Retrieved customer data from payments gateway', {
      userId: user.id,
      customerId: user.customerId,
    });

    const userMapped = EntityMapper.map(user, UserResponseDto);
    userMapped.address = EntityMapper.map(customer!.address, UserAddressResponseDto);

    await runAndIgnoreError(
      () =>
        this.cacheService.set(
          USER_KEY.CACHE_FIND_ONE(id),
          userMapped,
          CACHE_TTL.LIST,
        ),
      `caching user with ID: ${id}`,
      this.logger,
    );

    return userMapped;
  }

  async findByEmail(
    email: string,
    requestUser?: RequestUser,
  ): Promise<UserResponseDto> {
    const cacheKey = USER_KEY.CACHE_FIND_BY_EMAIL(email);

    const cachedResult = await runAndIgnoreError(
      () => this.cacheService.get<UserResponseDto>(cacheKey),
      `fetching user from cache with key: ${cacheKey}`,
      this.logger,
    );
    if (cachedResult) {
      this.assertUserAccess(cachedResult.id, requestUser);

      this.logger.debug('Returning cached user', { email });
      return cachedResult;
    }

    this.logger.debug('Finding user by email', { email });

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }

    this.assertUserAccess(user.id, requestUser);

    this.logger.debug('User found', { email });

    const customer = await this.ensureCustomersRetrieve(user.id, user.customerId);

    this.logger.debug('Retrieved customer data from payments gateway', {
      userId: user.id,
      customerId: user.customerId,
    });

    const userMapped = EntityMapper.map(user, UserResponseDto);
    userMapped.address = EntityMapper.map(customer!.address, UserAddressResponseDto);

    await runAndIgnoreError(
      () =>
        this.cacheService.set(
          USER_KEY.CACHE_FIND_BY_EMAIL(email),
          userMapped,
          CACHE_TTL.LIST,
        ),
      `caching user with email: ${email}`,
      this.logger,
    );

    return userMapped;
  }

  @Transactional()
  @UseLock({ prefix: 'user-update', key: ([id]) => id })
  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    requestUser?: RequestUser,
  ): Promise<UserResponseDto> {
    this.assertUserAccess(id, requestUser);

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
        where: { email: newEmail },
      });
      if (emailExists) {
        throw new ConflictException('Email already exists');
      }
    }

    // This will only update the fields that are present in updateUserDto
    Object.assign(user, updateUserDto);

    const updatedUser = await this.userRepository.save(user);

    this.logger.debug(`User updated successfully: ${updatedUser.id}`);

    // Add outbox message for updating Stripe customer (job)
    await this.outboxService.add(
      OutboxType.PAYMENT_UPDATE_CUSTOMER,
      new UpdateCustomerJobPayload(
        updatedUser.id,
        updatedUser.customerId,
        updatedUser.name,
        updatedUser.email,
        updateUserDto.address,
      ),
    );

    await this.cacheService.deleteBulk({
      keys: [USER_KEY.CACHE_FIND_BY_EMAIL(updatedUser.email)],
      patterns: [USER_KEY.CACHE_FIND_ALL_PATTERN()],
    });

    return EntityMapper.map(updatedUser, UserResponseDto);
  }

  @Transactional()
  @UseLock({ prefix: 'user-update', key: ([id]) => id })
  async updateLogin(
    id: string,
    updateLoginDto: UpdateLoginDto,
    requestUser?: RequestUser,
  ): Promise<UserResponseDto> {
    this.assertUserAccess(id, requestUser);

    this.logger.debug('Updating login for user', { userId: id });

    const user = await this.userRepository.findById(id);
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
        where: { email: updateLoginDto.email },
      });
      if (emailExists) {
        throw new ConflictException('Email already exists');
      }
      user.email = updateLoginDto.email;
    }

    const updatedUser = await this.userRepository.save(user);

    const userMapped = EntityMapper.map(updatedUser, UserResponseDto);

    await this.cacheService.deleteBulk({
      keys: [
        USER_KEY.CACHE_FIND_ONE(updatedUser.id),
        USER_KEY.CACHE_FIND_BY_EMAIL(updatedUser.email),
      ],
      patterns: [USER_KEY.CACHE_FIND_ALL_PATTERN()],
    });

    this.logger.debug('Login updated successfully for user', {
      userEmail: userMapped.email,
    });

    return userMapped;
  }

  @Transactional()
  @UseLock({ prefix: 'user-delete', key: ([id]) => id })
  async remove(id: string, requestUser?: RequestUser): Promise<void> {
    this.assertUserAccess(id, requestUser);

    this.logger.debug('Deleting user', { id });

    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    await this.userRepository.deleteById(id);

    this.logger.debug('User deleted successfully', { userId: id });

    // Add outbox message for deleting Stripe customer (job)
    await this.outboxService.add(
      OutboxType.PAYMENT_DELETE_CUSTOMER,
      new DeleteCustomerJobPayload(user.id, user.customerId, user.name, user.email),
    );

    await this.cacheService.deleteBulk({
      keys: [USER_KEY.CACHE_FIND_ONE(id), USER_KEY.CACHE_FIND_BY_EMAIL(user.email)],
      patterns: [USER_KEY.CACHE_FIND_ALL_PATTERN()],
    });
  }

  private async findOwnUserList(
    query: UserQueryDto,
    requestUser?: RequestUser,
  ): Promise<PaginatedResultDto<UserResponseDto>> {
    if (!requestUser) {
      throw new ForbiddenException('Authentication is required');
    }

    const user = await this.userRepository.findById(requestUser.id);
    if (!user) {
      throw new NotFoundException(`User with ID ${requestUser.id} not found`);
    }

    const matchesName =
      !query.name || user.name.toLowerCase().includes(query.name.toLowerCase());
    const matchesEmail =
      !query.email || user.email.toLowerCase().includes(query.email.toLowerCase());

    const data =
      matchesName && matchesEmail ? [EntityMapper.map(user, UserResponseDto)] : [];
    const total = data.length;
    const limit = query.limit ?? 10;
    const page = query.page ?? 1;

    return new PaginatedResultDto(total, page, limit, data);
  }

  private assertUserAccess(targetUserId: string, requestUser?: RequestUser): void {
    if (requestUser?.jwtPayload?.role === UserRole.ADMIN) {
      return;
    }

    if (!requestUser || requestUser.id !== targetUserId) {
      throw new ForbiddenException(
        `You are not allowed to access user with ID ${targetUserId}`,
      );
    }
  }

  private async ensureCustomersRetrieve(
    userId: string,
    customerId: string,
  ): Promise<CustomerResponseDto> {
    try {
      const customer =
        await this.paymentsGatewayService.customersRetrieve(customerId);
      return customer;
    } catch (e) {
      const error = ensureError(e);
      this.logger.error(
        '[CRITICAL] Failed to retrieve customer data from payments gateway',
        {
          userId: userId,
          customerId: customerId,
          errorMessage: error.message,
          stack: error.stack,
        },
      );
      throw error;
    }
  }
}
