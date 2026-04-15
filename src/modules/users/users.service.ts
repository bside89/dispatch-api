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
import {
  ensureError,
  runAndIgnoreError,
  template,
} from '@/shared/helpers/functions';
import { UseLock } from '@/shared/decorators/lock.decorator';
import Redlock from 'redlock';
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
import { LOCK_PREFIX } from '@/shared/constants/lock-prefix.constants';
import { TransactionalService } from '@/shared/services/transactional.service';
import { I18N_USERS } from '@/shared/constants/i18n/users.tokens';
import {
  UserAddressSnapshotDto,
  UserSnapshotDto,
} from '@/shared/dto/user-snapshot.dto';

@Injectable()
export class UsersService extends TransactionalService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly paymentsGatewayService: PaymentsGatewayService,
    private readonly cacheService: CacheService,
    private readonly outboxService: OutboxService,
    dataSource: DataSource,
    redlock: Redlock,
  ) {
    super(UsersService.name, dataSource, redlock);
  }

  @Transactional()
  @UseLock({
    prefix: LOCK_PREFIX.USER.CREATE,
    key: ([, idempotencyKey]) => idempotencyKey,
  })
  async create(
    dto: CreateUserDto,
    idempotencyKey: string,
  ): Promise<UserResponseDto> {
    // Check if there's an existing user for the same idempotency key
    const idempotencyKeyFormatted = USER_KEY.IDEMPOTENCY(
      this.create.name,
      idempotencyKey,
    );
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
      throw new ConflictException(
        template(I18N_USERS.ERRORS.EMAIL_ALREADY_EXISTS, { email: dto.email }),
      );
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
    const snapshottedUser = EntityMapper.map(savedUser, UserSnapshotDto);
    snapshottedUser.address = EntityMapper.map(dto.address, UserAddressSnapshotDto);
    await this.outboxService.add(
      OutboxType.PAYMENT_CREATE_CUSTOMER,
      new CreateCustomerJobPayload(snapshottedUser),
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
      throw new NotFoundException(
        template(I18N_USERS.ERRORS.USER_NOT_FOUND, { userId: id }),
      );
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
      throw new NotFoundException(
        template(I18N_USERS.ERRORS.USER_NOT_FOUND, { userId: email }),
      );
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
  @UseLock({ prefix: LOCK_PREFIX.USER.UPDATE, key: ([id]) => id })
  async update(
    id: string,
    dto: UpdateUserDto,
    requestUser?: RequestUser,
  ): Promise<UserResponseDto> {
    this.assertUserAccess(id, requestUser);

    this.logger.debug(`Updating user with ID: ${id}`);

    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(
        template(I18N_USERS.ERRORS.USER_NOT_FOUND, { userId: id }),
      );
    }

    // Check if email already exists (if email is being updated)
    const oldEmail = user.email;
    const newEmail = dto.email;
    if (newEmail && newEmail !== oldEmail) {
      const emailExists = await this.userRepository.existsBy({
        where: { email: newEmail },
      });
      if (emailExists) {
        throw new ConflictException(
          template(I18N_USERS.ERRORS.EMAIL_ALREADY_EXISTS, { email: newEmail }),
        );
      }
    }

    // This will only update the fields that are present in updateUserDto
    Object.assign(user, dto);
    const updatedUser = await this.userRepository.save(user);

    this.logger.debug(`User updated successfully: ${updatedUser.id}`);

    // Add outbox message for updating Stripe customer (job)
    const snapshottedUser = EntityMapper.map(updatedUser, UserSnapshotDto);
    snapshottedUser.address = EntityMapper.map(dto.address, UserAddressSnapshotDto);
    await this.outboxService.add(
      OutboxType.PAYMENT_UPDATE_CUSTOMER,
      new UpdateCustomerJobPayload(snapshottedUser),
    );

    await this.cacheService.deleteBulk({
      keys: [USER_KEY.CACHE_FIND_BY_EMAIL(updatedUser.email)],
      patterns: [USER_KEY.CACHE_FIND_ALL_PATTERN()],
    });

    return EntityMapper.map(updatedUser, UserResponseDto);
  }

  @Transactional()
  @UseLock({ prefix: LOCK_PREFIX.USER.UPDATE, key: ([id]) => id })
  async updateLogin(
    id: string,
    updateLoginDto: UpdateLoginDto,
    requestUser?: RequestUser,
  ): Promise<UserResponseDto> {
    this.assertUserAccess(id, requestUser);

    this.logger.debug('Updating login for user', { userId: id });

    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(
        template(I18N_USERS.ERRORS.USER_NOT_FOUND, { userId: id }),
      );
    }

    // Validate current password if new password is provided
    if (updateLoginDto.newPassword) {
      if (!updateLoginDto.currentPassword) {
        throw new BadRequestException(
          template(I18N_USERS.ERRORS.CURRENT_PASSWORD_REQUIRED),
        );
      }

      // Verify current password
      if (
        !(await HashUtils.compare(user.password, updateLoginDto.currentPassword))
      ) {
        throw new BadRequestException(
          template(I18N_USERS.ERRORS.CURRENT_PASSWORD_INVALID),
        );
      }
      user.password = await HashUtils.hash(updateLoginDto.newPassword);
    }

    if (updateLoginDto.email && updateLoginDto.email !== user.email) {
      const emailExists = await this.userRepository.existsBy({
        where: { email: updateLoginDto.email },
      });
      if (emailExists) {
        throw new ConflictException(
          template(I18N_USERS.ERRORS.EMAIL_ALREADY_EXISTS, {
            email: updateLoginDto.email,
          }),
        );
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
  @UseLock({ prefix: LOCK_PREFIX.USER.REMOVE, key: ([id]) => id })
  async remove(id: string, requestUser?: RequestUser): Promise<void> {
    this.assertUserAccess(id, requestUser);

    this.logger.debug('Deleting user', { id });

    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(
        template(I18N_USERS.ERRORS.USER_NOT_FOUND, { userId: id }),
      );
    }

    await this.userRepository.deleteById(id);

    this.logger.debug('User deleted successfully', { userId: id });

    // Add outbox message for deleting Stripe customer (job)
    const snapshottedUser = EntityMapper.map(user, UserSnapshotDto);
    await this.outboxService.add(
      OutboxType.PAYMENT_DELETE_CUSTOMER,
      new DeleteCustomerJobPayload(snapshottedUser),
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
      throw new ForbiddenException(template(I18N_USERS.ERRORS.AUTH_IS_REQUIRED));
    }

    const user = await this.userRepository.findById(requestUser.id);
    if (!user) {
      throw new NotFoundException(
        template(I18N_USERS.ERRORS.USER_NOT_FOUND, { userId: requestUser.id }),
      );
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
      throw new ForbiddenException(template(I18N_USERS.ERRORS.ACCESS_FORBIDDEN));
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
