import { PaginatedResultDto } from '@/shared/dto/paginated-result.dto';
import { CreateUserDto, PublicCreateUserDto } from '../dto/create-user.dto';
import { PublicUpdateUserDto, UpdateUserDto } from '../dto/update-user.dto';
import { PublicUserQueryDto, UserQueryDto } from '../dto/user-query.dto';
import {
  PublicUserResponseDto,
  UserResponseDto,
  UserSelfResponseDto,
} from '../dto/user-response.dto';
import type { RequestUser } from '@/modules/auth/interfaces/request-user.interface';

export interface IUsersService {
  publicCreate(
    dto: PublicCreateUserDto,
    idempotencyKey: string,
  ): Promise<UserSelfResponseDto>;

  publicFindMe(requestUser: RequestUser): Promise<UserSelfResponseDto>;

  publicFindOne(id: string): Promise<PublicUserResponseDto>;

  publicFindAll(
    query: PublicUserQueryDto,
  ): Promise<PaginatedResultDto<PublicUserResponseDto>>;

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

  adminFindAll(query: UserQueryDto): Promise<PaginatedResultDto<UserResponseDto>>;

  adminFindOne(id: string): Promise<UserResponseDto>;

  adminUpdate(
    id: string,
    dto: UpdateUserDto,
    requestUser: RequestUser,
  ): Promise<UserResponseDto>;

  adminRemove(id: string, requestUser: RequestUser): Promise<void>;
}
