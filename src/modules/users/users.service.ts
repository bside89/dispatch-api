import { I18N_USERS } from '@/shared/constants/i18n';
import { LOCK_KEY } from '@/shared/constants/lock.key';
import { USER_ROLE_LEVEL } from '@/shared/constants/user-role-level.constant';
import { PagCursorResultDto } from '@/shared/dto/pag-cursor-result.dto';
import {
  UserAddressSnapshotDto,
  UserSnapshotDto,
} from '@/shared/dto/snapshots/user-snapshot.dto';
import { DbGuardService } from '@/shared/modules/db-guard/db-guard.service';
import { OUTBOX_SERVICE } from '@/shared/modules/outbox/constants/outbox.token';
import type { IOutboxService } from '@/shared/modules/outbox/interfaces/outbox-service.interface';
import {
  CreateCustomerJobPayload,
  DeleteCustomerJobPayload,
  UpdateCustomerJobPayload,
} from '@/shared/payloads/payments-job.payload';
import { BaseService } from '@/shared/providers/services/base.service';
import type { CursorParams } from '@/shared/types/cursor-params.type';
import { EntityMapper } from '@/shared/utils/entity-mapper.utils';
import { template } from '@/shared/utils/functions.utils';
import { HashAdapter } from '@/shared/utils/hash-adapter.utils';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@/shared/enums/user-role.enum';
import { IDEMPOTENCY_SERVICE } from '@/shared/modules/cache/constants/idempotency.token';
import { USER_KEY } from '@/shared/modules/cache/constants/user.key';
import type { IIdempotencyService } from '@/shared/modules/cache/interfaces/idempotency-service.interface';
import type { RequestUser } from '../auth/interfaces/request-user.interface';
import { ADDRESS_REPOSITORY, USER_REPOSITORY } from './constants/users.token';
import { CreateUserDto, PublicCreateUserDto } from './dto/create-user.dto';
import { PublicUpdateUserDto, UpdateUserDto } from './dto/update-user.dto';
import { PublicUserQueryDto, UserQueryDto } from './dto/user-query.dto';
import {
  PublicUserResponseDto,
  UserAddressResponseDto,
  UserResponseDto,
  UserSelfResponseDto,
} from './dto/user-response.dto';
import { User } from './entities/user.entity';
import type { IAddressRepository } from './interfaces/address-repository.interface';
import type { IUserRepository } from './interfaces/user-repository.interface';
import { IUsersService } from './interfaces/users-service.interface';
import { BaseAddressDto } from '@/shared/dto/base-address.dto';
import { Address } from '@/modules/users/entities/address.entity';

@Injectable()
export class UsersService extends BaseService implements IUsersService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(ADDRESS_REPOSITORY)
    private readonly addressRepository: IAddressRepository,
    @Inject(IDEMPOTENCY_SERVICE)
    private readonly idempotencyService: IIdempotencyService,
    @Inject(OUTBOX_SERVICE) private readonly outboxService: IOutboxService,
    private readonly guard: DbGuardService,
  ) {
    super(UsersService.name);
  }

  //#region Public

  publicCreate(
    dto: PublicCreateUserDto,
    idempotencyKey: string,
  ): Promise<UserSelfResponseDto> {
    return this.guard.lockAndTransaction(LOCK_KEY.USER.CREATE(idempotencyKey), () =>
      this.idempotencyService.getOrExecute(
        USER_KEY.IDEMPOTENCY(this.publicCreate.name, idempotencyKey),
        () => this._publicCreate(dto, idempotencyKey),
      ),
    );
  }

  private async _publicCreate(
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

    let user = this.userRepository.createEntity({
      name: dto.name,
      email: dto.email,
      password: await HashAdapter.hash(dto.password),
    });
    user = await this.userRepository.save(user);
    const userMapped = EntityMapper.map(user, UserSelfResponseDto);
    const snapshot = EntityMapper.map(user, UserSnapshotDto);

    if (dto.address) {
      let address = this.addressRepository.createEntity({
        city: dto.address?.city,
        country: dto.address?.country,
        line1: dto.address?.line1,
        line2: dto.address?.line2,
        postalCode: dto.address?.postalCode,
        state: dto.address?.state,
        userId: user.id,
      });
      address = await this.addressRepository.save(address);
      userMapped.address = EntityMapper.map(address, UserAddressResponseDto);
      snapshot.address = EntityMapper.map(dto.address, UserAddressSnapshotDto);
    }

    await this.outboxService.add(new CreateCustomerJobPayload(snapshot));

    this.logger.debug('User created', {
      idempotencyKey,
      userId: user.id,
    });

    return userMapped;
  }

  async publicFindMe(requestUser: RequestUser): Promise<UserSelfResponseDto> {
    const user = await this.getUserOrThrow(requestUser.id);
    const userMapped = EntityMapper.map(user, UserSelfResponseDto);

    const address = await this.addressRepository.findOne({
      where: { userId: user.id },
    });
    if (address) {
      userMapped.address = EntityMapper.map(address, UserAddressResponseDto);
    }

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
    cursor?: CursorParams,
  ): Promise<PagCursorResultDto<PublicUserResponseDto>> {
    const result = await this.userRepository.filter({ ...query, cursor });

    const resultMapped = new PagCursorResultDto<PublicUserResponseDto>(
      EntityMapper.mapArray(result.items, PublicUserResponseDto),
      result.nextCursor,
      result.hasMore,
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
    let user = await this.getUserOrThrow(requestUser.id);

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
    user = await this.userRepository.save(user);
    const userMapped = EntityMapper.map(user, UserSelfResponseDto);
    const snapshot = EntityMapper.map(user, UserSnapshotDto);

    if (dto.address) {
      const address = await this.createOrUpdateAddress(dto.address, user.id);
      snapshot.address = EntityMapper.map(address, UserAddressSnapshotDto);
    }

    await this.outboxService.add(new UpdateCustomerJobPayload(snapshot));

    this.logger.debug(`User updated successfully: ${user.id}`);

    return userMapped;
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

    const snapshot = EntityMapper.map(user, UserSnapshotDto);
    await this.outboxService.add(new DeleteCustomerJobPayload(snapshot));
  }

  //#endregion

  //#region Admin

  adminCreate(
    dto: CreateUserDto,
    idempotencyKey: string,
    requestUser: RequestUser,
  ): Promise<UserResponseDto> {
    return this.guard.lockAndTransaction(
      `${LOCK_KEY.USER.CREATE}:${idempotencyKey}`,
      () =>
        this.idempotencyService.getOrExecute(
          USER_KEY.IDEMPOTENCY(this.adminCreate.name, idempotencyKey),
          async () => this._adminCreate(dto, idempotencyKey, requestUser),
        ),
    );
  }

  private async _adminCreate(
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

    let user = this.userRepository.createEntity({
      name: dto.name,
      email: dto.email,
      password: await HashAdapter.hash(dto.password),
      language: dto.language || 'en',
      role: dto.role || UserRole.USER,
    });
    user = await this.userRepository.save(user);
    const userMapped = EntityMapper.map(user, UserResponseDto);
    const snapshot = EntityMapper.map(user, UserSnapshotDto);

    if (dto.address) {
      let address = this.addressRepository.createEntity({
        city: dto.address?.city,
        country: dto.address?.country,
        line1: dto.address?.line1,
        line2: dto.address?.line2,
        postalCode: dto.address?.postalCode,
        state: dto.address?.state,
        userId: user.id,
      });
      address = await this.addressRepository.save(address);
      snapshot.address = EntityMapper.map(address, UserAddressSnapshotDto);
    }

    await this.outboxService.add(new CreateCustomerJobPayload(snapshot));

    this.logger.debug('User created', {
      idempotencyKey,
      userId: user.id,
    });

    return userMapped;
  }

  async adminFindAll(
    query: UserQueryDto,
    cursor?: CursorParams,
  ): Promise<PagCursorResultDto<UserResponseDto>> {
    const result = await this.userRepository.filter({ ...query, cursor });

    const resultMapped = new PagCursorResultDto<UserResponseDto>(
      EntityMapper.mapArray(result.items, UserResponseDto),
      result.nextCursor,
      result.hasMore,
    );

    this.logger.debug(`Retrieved ${result.items.length} users`);

    return resultMapped;
  }

  async adminFindOne(id: string): Promise<UserResponseDto> {
    const user = await this.getUserOrThrow(id);

    const address = await this.addressRepository.findOne({
      where: { userId: user.id },
    });

    const userMapped = EntityMapper.map(user, UserResponseDto);
    userMapped.address = EntityMapper.map(address, UserAddressResponseDto);

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
    let user = await this.getUserOrThrow(id);

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
    user = await this.userRepository.save(user);
    const snapshot = EntityMapper.map(user, UserSnapshotDto);

    if (dto.address) {
      const address = await this.createOrUpdateAddress(dto.address, user.id);
      snapshot.address = EntityMapper.map(address, UserAddressSnapshotDto);
    }

    await this.outboxService.add(new UpdateCustomerJobPayload(snapshot));

    this.logger.debug(`User updated successfully: ${user.id}`);

    return EntityMapper.map(user, UserResponseDto);
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

    const snapshot = EntityMapper.map(user, UserSnapshotDto);
    await this.outboxService.add(new DeleteCustomerJobPayload(snapshot));

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

  private async createOrUpdateAddress(
    dto: BaseAddressDto,
    userId: string,
  ): Promise<Address> {
    let address = await this.addressRepository.findOne({
      where: { userId: userId },
    });
    if (address) {
      Object.assign(address, dto);
      address = await this.addressRepository.save(address);
    } else {
      address = this.addressRepository.createEntity({
        city: dto?.city,
        country: dto?.country,
        line1: dto?.line1,
        line2: dto?.line2,
        postalCode: dto?.postalCode,
        state: dto?.state,
        userId: userId,
      });
      address = await this.addressRepository.save(address);
    }
    return address;
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

  //#endregion
}
