import { PagOffsetResultDto } from '@/shared/dto/pag-offset-result.dto';
import { CreateUserDto, PublicCreateUserDto } from '../dto/create-user.dto';
import { PublicUpdateUserDto, UpdateUserDto } from '../dto/update-user.dto';
import { PublicUserQueryDto, UserQueryDto } from '../dto/user-query.dto';
import {
  PublicUserResponseDto,
  UserResponseDto,
  UserSelfResponseDto,
} from '../dto/user-response.dto';
import type { RequestUser } from '@/modules/auth/interfaces/request-user.interface';
import { IBaseService } from '@/shared/services/base-service.interface';

export interface IUsersService extends IBaseService {
  publicCreate(
    dto: PublicCreateUserDto,
    idempotencyKey: string,
  ): Promise<UserSelfResponseDto>;

  publicFindMe(requestUser: RequestUser): Promise<UserSelfResponseDto>;

  publicFindOne(id: string): Promise<PublicUserResponseDto>;

  publicFindAll(
    query: PublicUserQueryDto,
  ): Promise<PagOffsetResultDto<PublicUserResponseDto>>;

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

  adminFindAll(query: UserQueryDto): Promise<PagOffsetResultDto<UserResponseDto>>;

  adminFindOne(id: string): Promise<UserResponseDto>;

  adminUpdate(
    id: string,
    dto: UpdateUserDto,
    requestUser: RequestUser,
  ): Promise<UserResponseDto>;

  adminRemove(id: string, requestUser: RequestUser): Promise<void>;
}
