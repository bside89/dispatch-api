import {
  ForbiddenException,
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { IDEMPOTENCY_SERVICE } from '../../shared/modules/cache/constants/idempotency.token';
import type { IIdempotencyService } from '../../shared/modules/cache/interfaces/idempotency-service.interface';
import { CreateUserDto, PublicCreateUserDto } from './dto/create-user.dto';
import { PublicUpdateUserDto, UpdateUserDto } from './dto/update-user.dto';
import { PublicUserQueryDto, UserQueryDto } from './dto/user-query.dto';
import type { IUserRepository } from './interfaces/user-repository.interface';
import { USER_REPOSITORY } from './constants/users.token';
import { PagOffsetResultDto } from '@/shared/dto/pag-offset-result.dto';
import {
  PublicUserResponseDto,
  UserAddressResponseDto,
  UserResponseDto,
  UserSelfResponseDto,
} from './dto/user-response.dto';
import { EntityMapper } from '@/shared/utils/entity-mapper.utils';
import { HashAdapter } from '@/shared/utils/hash-adapter.utils';
import { ensureError, template } from '@/shared/utils/functions.utils';
import { USER_KEY } from '../../shared/modules/cache/constants/user.key';
import type { IOutboxService } from '@/shared/modules/outbox/interfaces/outbox-service.interface';
import { OUTBOX_SERVICE } from '@/shared/modules/outbox/constants/outbox.token';
import {
  CreateCustomerJobPayload,
  DeleteCustomerJobPayload,
  UpdateCustomerJobPayload,
} from '@/shared/payloads/payments-job.payload';
import type { RequestUser } from '../auth/interfaces/request-user.interface';
import { UserRole } from '../../shared/enums/user-role.enum';
import type { IPaymentsGatewayService } from '../payments-gateway/interfaces/payments-gateway-service.interface';
import { PAYMENTS_GATEWAY_SERVICE } from '../payments-gateway/constants/payments-gateway.token';
import { GatewayCustomerResponseDto } from '../payments-gateway/dto/gateway-customer-response.dto';
import { I18N_USERS } from '@/shared/constants/i18n';
import {
  UserAddressSnapshotDto,
  UserSnapshotDto,
} from '@/shared/dto/user-snapshot.dto';
import { User } from './entities/user.entity';
import { USER_ROLE_LEVEL } from '@/shared/constants/user-role-level.constant';
import { IUsersService } from './interfaces/users-service.interface';
import { BaseService } from '@/shared/services/base.service';
import { DbGuardService } from '@/shared/modules/db-guard/db-guard.service';
import { LOCK_KEY } from '@/shared/constants/lock.key';

@Injectable()
export class UsersService extends BaseService implements IUsersService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(PAYMENTS_GATEWAY_SERVICE)
    private readonly paymentsGatewayService: IPaymentsGatewayService,
    @Inject(IDEMPOTENCY_SERVICE)
    private readonly idempotencyService: IIdempotencyService,
    @Inject(OUTBOX_SERVICE) private readonly outboxService: IOutboxService,
    private readonly guard: DbGuardService,
  ) {
    super(UsersService.name);
  }

  //#region Public endpoints

  publicCreate(
    dto: PublicCreateUserDto,
    idempotencyKey: string,
  ): Promise<UserSelfResponseDto> {
    return this.guard.lockAndTransaction(LOCK_KEY.USER.CREATE(idempotencyKey), () =>
      this._publicCreate(dto, idempotencyKey),
    );
  }

  private async _publicCreate(
    dto: PublicCreateUserDto,
    idempotencyKey: string,
  ): Promise<UserSelfResponseDto> {
    const idempotencyKeyFormatted = USER_KEY.IDEMPOTENCY(
      this.publicCreate.name,
      idempotencyKey,
    );

    return this.idempotencyService.getOrExecute(idempotencyKeyFormatted, () =>
      this._publicCreateWithIdempotency(dto, idempotencyKeyFormatted),
    );
  }

  private async _publicCreateWithIdempotency(
    dto: PublicCreateUserDto,
    idempotencyKey: string,
  ): Promise<UserSelfResponseDto> {
    const emailExists = await this.userRepository.existsBy({
      where: { email: dto.email },
    });
    if (emailExists) {
      throw new ConflictException(
        template(I18N_USERS.ERRORS.EMAIL_ALREADY_EXISTS, { email: dto.email }),
      );
    }

    const user = this.userRepository.createEntity({
      name: dto.name,
      email: dto.email,
      password: await HashAdapter.hash(dto.password),
    });
    const savedUser = await this.userRepository.save(user);
    const userMapped = EntityMapper.map(savedUser, UserSelfResponseDto);

    const snapshottedUser = EntityMapper.map(savedUser, UserSnapshotDto);
    snapshottedUser.address = EntityMapper.map(dto.address, UserAddressSnapshotDto);
    await this.outboxService.add(new CreateCustomerJobPayload(snapshottedUser));

    this.logger.debug('User created', {
      idempotencyKey,
      userId: savedUser.id,
    });

    return userMapped;
  }

  async publicFindMe(requestUser: RequestUser): Promise<UserSelfResponseDto> {
    const user = await this.getUserOrThrow(requestUser.id);

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
    const user = await this.getUserOrThrow(id);

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
  ): Promise<PagOffsetResultDto<PublicUserResponseDto>> {
    const result = await this.userRepository.filter(query);

    const resultMapped = new PagOffsetResultDto<PublicUserResponseDto>(
      result.meta.total,
      result.meta.page,
      result.meta.limit,
      EntityMapper.mapArray(result.items, PublicUserResponseDto),
    );

    this.logger.debug(`Retrieved ${result.items.length} users with public query`, {
      query,
    });

    return resultMapped;
  }

  publicUpdate(
    dto: PublicUpdateUserDto,
    requestUser: RequestUser,
  ): Promise<UserSelfResponseDto> {
    return this.guard.lockAndTransaction(LOCK_KEY.USER.UPDATE(requestUser.id), () =>
      this._publicUpdate(dto, requestUser),
    );
  }

  private async _publicUpdate(
    dto: PublicUpdateUserDto,
    requestUser: RequestUser,
  ): Promise<UserSelfResponseDto> {
    const user = await this.getUserOrThrow(requestUser.id);

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

    Object.assign(user, dto);
    const updatedUser = await this.userRepository.save(user);

    const snapshottedUser = EntityMapper.map(updatedUser, UserSnapshotDto);
    snapshottedUser.address = EntityMapper.map(dto.address, UserAddressSnapshotDto);
    await this.outboxService.add(new UpdateCustomerJobPayload(snapshottedUser));

    this.logger.debug(`User updated successfully: ${updatedUser.id}`);

    return EntityMapper.map(updatedUser, UserSelfResponseDto);
  }

  publicRemove(requestUser: RequestUser): Promise<void> {
    return this.guard.lockAndTransaction(LOCK_KEY.USER.REMOVE(requestUser.id), () =>
      this._publicRemove(requestUser),
    );
  }

  private async _publicRemove(requestUser: RequestUser): Promise<void> {
    const user = await this.getUserOrThrow(requestUser.id);

    await this.assertWriteAccess(user, requestUser);

    await this.userRepository.softDelete(user);

    const snapshottedUser = EntityMapper.map(user, UserSnapshotDto);
    await this.outboxService.add(new DeleteCustomerJobPayload(snapshottedUser));
  }

  //#endregion

  //#region Admin endpoints

  adminCreate(
    dto: CreateUserDto,
    idempotencyKey: string,
    requestUser: RequestUser,
  ): Promise<UserResponseDto> {
    return this.guard.lockAndTransaction(
      `${LOCK_KEY.USER.CREATE}:${idempotencyKey}`,
      () => this._adminCreate(dto, idempotencyKey, requestUser),
    );
  }

  private async _adminCreate(
    dto: CreateUserDto,
    idempotencyKey: string,
    requestUser: RequestUser,
  ): Promise<UserResponseDto> {
    const idempotencyKeyFormatted = USER_KEY.IDEMPOTENCY(
      this.adminCreate.name,
      idempotencyKey,
    );

    return this.idempotencyService.getOrExecute(idempotencyKeyFormatted, async () =>
      this._adminCreateWithIdempotency(dto, idempotencyKeyFormatted, requestUser),
    );
  }

  private async _adminCreateWithIdempotency(
    dto: CreateUserDto,
    idempotencyKey: string,
    requestUser: RequestUser,
  ): Promise<UserResponseDto> {
    const emailExists = await this.userRepository.existsBy({
      where: { email: dto.email },
    });
    if (emailExists) {
      throw new ConflictException(
        template(I18N_USERS.ERRORS.EMAIL_ALREADY_EXISTS, { email: dto.email }),
      );
    }
    await this.assertRoleWriteAccess(dto.role, requestUser);

    const user = this.userRepository.createEntity({
      name: dto.name,
      email: dto.email,
      password: await HashAdapter.hash(dto.password),
      language: dto.language || 'en',
      role: dto.role || UserRole.USER,
    });
    const savedUser = await this.userRepository.save(user);
    const userMapped = EntityMapper.map(savedUser, UserResponseDto);

    const snapshottedUser = EntityMapper.map(savedUser, UserSnapshotDto);
    snapshottedUser.address = EntityMapper.map(dto.address, UserAddressSnapshotDto);
    await this.outboxService.add(new CreateCustomerJobPayload(snapshottedUser));

    this.logger.debug('User created', {
      idempotencyKey,
      userId: savedUser.id,
    });

    return userMapped;
  }

  async adminFindAll(
    query: UserQueryDto,
  ): Promise<PagOffsetResultDto<UserResponseDto>> {
    const result = await this.userRepository.filter(query);

    const resultMapped = new PagOffsetResultDto<UserResponseDto>(
      result.meta.total,
      result.meta.page,
      result.meta.limit,
      EntityMapper.mapArray(result.items, UserResponseDto),
    );

    this.logger.debug(`Retrieved ${result.items.length} users`);

    return resultMapped;
  }

  async adminFindOne(id: string): Promise<UserResponseDto> {
    const user = await this.getUserOrThrow(id);

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

  adminUpdate(
    id: string,
    dto: UpdateUserDto,
    requestUser: RequestUser,
  ): Promise<UserResponseDto> {
    return this.guard.lockAndTransaction(LOCK_KEY.USER.UPDATE(id), () =>
      this._adminUpdate(id, dto, requestUser),
    );
  }

  private async _adminUpdate(
    id: string,
    dto: UpdateUserDto,
    requestUser: RequestUser,
  ): Promise<UserResponseDto> {
    const user = await this.getUserOrThrow(id);

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
    await this.assertWriteAccess(user, requestUser);

    Object.assign(user, dto);
    const updatedUser = await this.userRepository.save(user);

    const snapshottedUser = EntityMapper.map(updatedUser, UserSnapshotDto);
    snapshottedUser.address = EntityMapper.map(dto.address, UserAddressSnapshotDto);
    await this.outboxService.add(new UpdateCustomerJobPayload(snapshottedUser));

    this.logger.debug(`User updated successfully: ${updatedUser.id}`);

    return EntityMapper.map(updatedUser, UserResponseDto);
  }

  adminRemove(id: string, requestUser: RequestUser): Promise<void> {
    return this.guard.lockAndTransaction(LOCK_KEY.USER.REMOVE(id), () =>
      this._adminRemove(id, requestUser),
    );
  }

  private async _adminRemove(id: string, requestUser: RequestUser): Promise<void> {
    const user = await this.getUserOrThrow(id);

    await this.assertWriteAccess(user, requestUser);

    await this.userRepository.softDelete(user);

    const snapshottedUser = EntityMapper.map(user, UserSnapshotDto);
    await this.outboxService.add(new DeleteCustomerJobPayload(snapshottedUser));

    this.logger.debug('User deleted successfully', { userId: id });
  }

  //#endregion

  //#region Private methods

  private async getUserOrThrow(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(template(I18N_USERS.ERRORS.USER_NOT_FOUND));
    }
    return user;
  }

  private async assertWriteAccess(targetUser: User, requestUser?: RequestUser) {
    if (!requestUser) {
      throw new ForbiddenException(template(I18N_USERS.ERRORS.AUTH_IS_REQUIRED));
    }

    const requestUserRoleLevel = USER_ROLE_LEVEL[requestUser.role];
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

    const requestUserRoleLevel = USER_ROLE_LEVEL[requestUser.role];
    const targetRoleLevel = USER_ROLE_LEVEL[targetRole];

    if (requestUserRoleLevel <= targetRoleLevel) {
      throw new ForbiddenException(template(I18N_USERS.ERRORS.ROLE_CHANGE_DENIED));
    }
  }

  private async ensureCustomersRetrieve(
    userId: string,
    customerId: string,
  ): Promise<GatewayCustomerResponseDto> {
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
