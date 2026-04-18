import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { CacheService } from '../../shared/modules/cache/cache.service';
import { CreateUserDto, PublicCreateUserDto } from './dto/create-user.dto';
import { PublicUpdateUserDto, UpdateUserDto } from './dto/update-user.dto';
import { PublicUserQueryDto, UserQueryDto } from './dto/user-query.dto';
import { UserRepository } from './repositories/user.repository';
import { PaginatedResultDto } from '@/shared/dto/paginated-result.dto';
import {
  PublicUserResponseDto,
  UserAddressResponseDto,
  UserResponseDto,
  UserSelfResponseDto,
} from './dto/user-response.dto';
import { EntityMapper } from '@/shared/utils/entity-mapper';
import { HashUtils } from '@/shared/utils/hash.utils';
import { DataSource } from 'typeorm';
import { Transactional } from '@/shared/decorators/transactional.decorator';
import { CACHE_TTL } from '@/shared/constants/cache-ttl.constant';
import { ensureError, template } from '@/shared/helpers/functions';
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
import { UserRole } from '../../shared/enums/user-role.enum';
import { PaymentsGatewayService } from '../payments-gateway/payments-gateway.service';
import { CustomerResponseDto } from '../payments-gateway/dto/customer-response.dto';
import { LOCK_PREFIX } from '@/shared/constants/lock-prefix.constant';
import { TransactionalService } from '@/shared/services/transactional.service';
import { I18N_USERS } from '@/shared/constants/i18n';
import {
  UserAddressSnapshotDto,
  UserSnapshotDto,
} from '@/shared/dto/user-snapshot.dto';
import { User } from './entities/user.entity';
import { USER_ROLE_LEVEL } from '@/shared/constants/user-role-level.constant';

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

  //#region Public endpoints

  @Transactional()
  @UseLock({
    prefix: LOCK_PREFIX.USER.CREATE,
    key: ([, idempotencyKey]) => idempotencyKey,
  })
  async publicCreate(
    dto: PublicCreateUserDto,
    idempotencyKey: string,
  ): Promise<UserSelfResponseDto> {
    /** 1. VALIDATION AND IDEMPOTENCY CHECK */

    const idempotencyKeyFormatted = USER_KEY.IDEMPOTENCY(
      this.publicCreate.name,
      idempotencyKey,
    );
    const existingUser = await this.cacheService.get<UserSelfResponseDto>(
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

    /** 2. CREATE USER */

    const user = this.userRepository.createEntity({
      name: dto.name,
      email: dto.email,
      password: await HashUtils.hash(dto.password),
    });
    const savedUser = await this.userRepository.save(user);
    const userMapped = EntityMapper.map(savedUser, UserSelfResponseDto);

    /** 3. SIDE EFFECTS */

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

    return userMapped;
  }

  async publicFindMe(requestUser: RequestUser): Promise<UserSelfResponseDto> {
    const user = await this.userRepository.findById(requestUser.id);
    if (!user) {
      throw new NotFoundException(template(I18N_USERS.ERRORS.USER_NOT_FOUND));
    }

    const customer = await this.ensureCustomersRetrieve(user.id, user.customerId);

    this.logger.debug('Retrieved customer data from payments gateway', {
      userId: user.id,
      customerId: user.customerId,
    });

    const userMapped = EntityMapper.map(user, UserSelfResponseDto);
    userMapped.address = EntityMapper.map(customer!.address, UserAddressResponseDto);

    this.logger.debug('Retrieved user profile', { id: userMapped.id });

    return userMapped;
  }

  async publicFindOne(id: string): Promise<PublicUserResponseDto> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(template(I18N_USERS.ERRORS.USER_NOT_FOUND));
    }

    this.logger.debug('Retrieved customer data from payments gateway', {
      userId: user.id,
      customerId: user.customerId,
    });

    const userMapped = EntityMapper.map(user, PublicUserResponseDto);

    this.logger.debug('User found', { id: userMapped.id });

    return userMapped;
  }

  async publicFindAll(
    query: PublicUserQueryDto,
  ): Promise<PaginatedResultDto<PublicUserResponseDto>> {
    const result = await this.userRepository.filter(query);

    const resultMapped = new PaginatedResultDto<PublicUserResponseDto>(
      result.total,
      result.page,
      result.limit,
      EntityMapper.mapArray(result.data, PublicUserResponseDto),
    );

    this.logger.debug(`Retrieved ${result.data.length} users with public query`, {
      query,
    });

    return resultMapped;
  }

  @Transactional()
  @UseLock({ prefix: LOCK_PREFIX.USER.UPDATE, key: ([id]) => id })
  async publicUpdate(
    dto: PublicUpdateUserDto,
    requestUser: RequestUser,
  ): Promise<UserSelfResponseDto> {
    const user = await this.userRepository.findById(requestUser.id);

    /** 1. VALIDATION */

    if (!user) {
      throw new NotFoundException(template(I18N_USERS.ERRORS.USER_NOT_FOUND));
    }

    const oldEmail = user.email;
    const newEmail = dto.email;
    if (newEmail && newEmail !== oldEmail) {
      const emailExists = await this.userRepository.existsBy({
        where: { email: newEmail },
      });
      if (emailExists) {
        throw new ConflictException(
          template(I18N_USERS.ERRORS.EMAIL_ALREADY_EXISTS),
        );
      }
    }

    /** 2. UPDATE USER */

    Object.assign(user, dto);
    const updatedUser = await this.userRepository.save(user);

    /** 3. SIDE EFFECTS */

    const snapshottedUser = EntityMapper.map(updatedUser, UserSnapshotDto);
    snapshottedUser.address = EntityMapper.map(dto.address, UserAddressSnapshotDto);
    await this.outboxService.add(
      OutboxType.PAYMENT_UPDATE_CUSTOMER,
      new UpdateCustomerJobPayload(snapshottedUser),
    );

    this.logger.debug(`User updated successfully: ${updatedUser.id}`);

    return EntityMapper.map(updatedUser, UserSelfResponseDto);
  }

  @Transactional()
  @UseLock({
    prefix: LOCK_PREFIX.USER.REMOVE,
    key: ([requestUser]) => requestUser.id,
  })
  async publicRemove(requestUser: RequestUser): Promise<void> {
    const user = await this.userRepository.findById(requestUser.id);

    /** 1. VALIDATION */

    if (!user) {
      throw new NotFoundException(template(I18N_USERS.ERRORS.USER_NOT_FOUND));
    }
    await this.assertWriteAccess(user, requestUser);

    /** 2. DEACTIVATE USER */

    await this.userRepository.softDelete(user);

    /** 3. SIDE EFFECTS */

    const snapshottedUser = EntityMapper.map(user, UserSnapshotDto);
    await this.outboxService.add(
      OutboxType.PAYMENT_DELETE_CUSTOMER,
      new DeleteCustomerJobPayload(snapshottedUser),
    );
  }

  //#endregion

  //#region Admin endpoints

  @Transactional()
  @UseLock({
    prefix: LOCK_PREFIX.USER.CREATE,
    key: ([, idempotencyKey]) => idempotencyKey,
  })
  async adminCreate(
    dto: CreateUserDto,
    idempotencyKey: string,
    requestUser: RequestUser,
  ): Promise<UserResponseDto> {
    /** 1. VALIDATION AND IDEMPOTENCY CHECK */

    const idempotencyKeyFormatted = USER_KEY.IDEMPOTENCY(
      this.adminCreate.name,
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
    await this.assertRoleWriteAccess(dto.role, requestUser);

    /** 2. CREATE USER */

    const user = this.userRepository.createEntity({
      name: dto.name,
      email: dto.email,
      password: await HashUtils.hash(dto.password),
      language: dto.language || 'en',
      role: dto.role || UserRole.USER,
    });
    const savedUser = await this.userRepository.save(user);
    const userMapped = EntityMapper.map(savedUser, UserResponseDto);

    /** 3. SIDE EFFECTS */

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

    return userMapped;
  }

  async adminFindAll(
    query: UserQueryDto,
  ): Promise<PaginatedResultDto<UserResponseDto>> {
    const result = await this.userRepository.filter(query);

    const resultMapped = new PaginatedResultDto<UserResponseDto>(
      result.total,
      result.page,
      result.limit,
      EntityMapper.mapArray(result.data, UserResponseDto),
    );

    this.logger.debug(`Retrieved ${result.data.length} users`);

    return resultMapped;
  }

  async adminFindOne(id: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(template(I18N_USERS.ERRORS.USER_NOT_FOUND));
    }

    const customer = await this.ensureCustomersRetrieve(user.id, user.customerId);

    this.logger.debug('Retrieved customer data from payments gateway', {
      userId: user.id,
      customerId: user.customerId,
    });

    const userMapped = EntityMapper.map(user, UserResponseDto);
    userMapped.address = EntityMapper.map(customer!.address, UserAddressResponseDto);

    this.logger.debug('User found', { id: userMapped.id });

    return userMapped;
  }

  @Transactional()
  @UseLock({ prefix: LOCK_PREFIX.USER.UPDATE, key: ([id]) => id })
  async adminUpdate(
    id: string,
    dto: UpdateUserDto,
    requestUser: RequestUser,
  ): Promise<UserResponseDto> {
    const user = await this.userRepository.findById(id);

    /** 1. VALIDATION */

    if (!user) {
      throw new NotFoundException(template(I18N_USERS.ERRORS.USER_NOT_FOUND));
    }

    const oldEmail = user.email;
    const newEmail = dto.email;
    if (newEmail && newEmail !== oldEmail) {
      const emailExists = await this.userRepository.existsBy({
        where: { email: newEmail },
      });
      if (emailExists) {
        throw new ConflictException(
          template(I18N_USERS.ERRORS.EMAIL_ALREADY_EXISTS),
        );
      }
    }
    await this.assertWriteAccess(user, requestUser);

    /** 2. UPDATE USER */

    Object.assign(user, dto);
    const updatedUser = await this.userRepository.save(user);

    /** 3. SIDE EFFECTS */

    const snapshottedUser = EntityMapper.map(updatedUser, UserSnapshotDto);
    snapshottedUser.address = EntityMapper.map(dto.address, UserAddressSnapshotDto);
    await this.outboxService.add(
      OutboxType.PAYMENT_UPDATE_CUSTOMER,
      new UpdateCustomerJobPayload(snapshottedUser),
    );

    this.logger.debug(`User updated successfully: ${updatedUser.id}`);

    return EntityMapper.map(updatedUser, UserResponseDto);
  }

  @Transactional()
  @UseLock({ prefix: LOCK_PREFIX.USER.REMOVE, key: ([id]) => id })
  async adminRemove(id: string, requestUser: RequestUser): Promise<void> {
    const user = await this.userRepository.findById(id);

    /** 1. VALIDATION */

    if (!user) {
      throw new NotFoundException(template(I18N_USERS.ERRORS.USER_NOT_FOUND));
    }
    await this.assertWriteAccess(user, requestUser);

    /** 2. DELETE USER */

    await this.userRepository.softDelete(user);

    /** 3. SIDE EFFECTS */

    const snapshottedUser = EntityMapper.map(user, UserSnapshotDto);
    await this.outboxService.add(
      OutboxType.PAYMENT_DELETE_CUSTOMER,
      new DeleteCustomerJobPayload(snapshottedUser),
    );

    this.logger.debug('User deleted successfully', { userId: id });
  }

  //#endregion

  //#region Private methods

  private async assertWriteAccess(targetUser: User, requestUser?: RequestUser) {
    if (!requestUser) {
      throw new ForbiddenException(template(I18N_USERS.ERRORS.AUTH_IS_REQUIRED));
    }

    const requestUserRoleLevel = USER_ROLE_LEVEL[requestUser.jwtPayload.role];
    const targetUserRoleLevel = USER_ROLE_LEVEL[targetUser.role];

    if (requestUserRoleLevel <= targetUserRoleLevel) {
      throw new ForbiddenException(template(I18N_USERS.ERRORS.ACCESS_DENIED));
    }
  }

  private async assertRoleWriteAccess(
    targetRole: UserRole,
    requestUser?: RequestUser,
  ) {
    if (!requestUser) {
      throw new ForbiddenException(template(I18N_USERS.ERRORS.AUTH_IS_REQUIRED));
    }

    const requestUserRoleLevel = USER_ROLE_LEVEL[requestUser.jwtPayload.role];
    const targetRoleLevel = USER_ROLE_LEVEL[targetRole];

    if (requestUserRoleLevel <= targetRoleLevel) {
      throw new ForbiddenException(template(I18N_USERS.ERRORS.ROLE_CHANGE_DENIED));
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

  //#endregion
}
