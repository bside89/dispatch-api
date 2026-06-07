import { PagCursorResultDto } from '@/shared/dto/pag-cursor-result.dto';
import type { CursorParams } from '@/shared/types/cursor-params.type';
import type { RequestUser } from '@/modules/auth/interfaces/request-user.interface';
import { IBaseService } from '@/shared/services/base-service.interface';
import { CreateUserDto, PublicCreateUserDto } from '../dto/create-user.dto';
import { PublicUpdateUserDto, UpdateUserDto } from '../dto/update-user.dto';
import { PublicUserQueryDto, UserQueryDto } from '../dto/user-query.dto';
import {
  PublicUserResponseDto,
  UserResponseDto,
  UserSelfResponseDto,
} from '../dto/user-response.dto';

export interface IUsersService extends IBaseService {
  publicCreate(
    dto: PublicCreateUserDto,
    idempotencyKey: string,
  ): Promise<UserSelfResponseDto>;

  publicFindMe(requestUser: RequestUser): Promise<UserSelfResponseDto>;

  publicFindOne(id: string): Promise<PublicUserResponseDto>;

  publicFindAll(
    query: PublicUserQueryDto,
    cursor?: CursorParams,
  ): Promise<PagCursorResultDto<PublicUserResponseDto>>;

  publicUpdate(
    dto: PublicUpdateUserDto,
    requestUser: RequestUser,
  ): Promise<UserSelfResponseDto>;

  publicRemove(requestUser: RequestUser): Promise<void>;

  adminCreate(
    dto: CreateUserDto,
    idempotencyKey: string,
    requestUser: RequestUser,
  ): Promise<UserResponseDto>;

  adminFindAll(
    query: UserQueryDto,
    cursor?: CursorParams,
  ): Promise<PagCursorResultDto<UserResponseDto>>;

  adminFindOne(id: string): Promise<UserResponseDto>;

  adminUpdate(
    id: string,
    dto: UpdateUserDto,
    requestUser: RequestUser,
  ): Promise<UserResponseDto>;

  adminRemove(id: string, requestUser: RequestUser): Promise<void>;
}
