import { I18N_COMMON } from '@/shared/constants/i18n/i18n-common.constant';
import { ROLE_GROUPS } from '@/shared/constants/role-groups.constant';
import { GetUser } from '@/shared/decorators/get-user.decorator';
import { PagCursorResultDto } from '@/shared/dto/pag-cursor-result.dto';
import { CursorParamsPipe } from '@/shared/pipes/cursor-params.pipe';
import type { CursorParams } from '@/shared/types/cursor-params.type';
import { template } from '@/shared/utils/functions.utils';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { resolveThrottleLimit } from '../../config/throttle.config';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RequestUser } from '../auth/interfaces/request-user.interface';
import { USERS_SERVICE } from './constants/users.token';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { UserResponseDto } from './dto/user-response.dto';
import type { IUsersService } from './interfaces/users-service.interface';
@Controller({ path: 'v1/admin/users', version: '1' })
@ApiTags('users-admin')
@ApiSecurity('bearer')
export class AdminUsersController {
  constructor(@Inject(USERS_SERVICE) private readonly usersService: IUsersService) {}

  @Post()
  @Roles(...ROLE_GROUPS.COMMON.ADMIN_MANAGEMENT)
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: resolveThrottleLimit(10) } })
  @ApiOperation({
    summary: 'Create a new user',
    description:
      'Creates a new user with the provided information. ' +
      'Requires idempotency-key header to prevent duplicate users.',
  })
  @ApiHeader({
    name: 'idempotency-key',
    description:
      'Unique key to ensure idempotent requests. Use UUID or any unique string.',
    required: true,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiCreatedResponse({
    description: 'User created successfully',
    type: UserResponseDto,
  })
  @ApiConflictResponse({
    description: 'Email already exists',
  })
  @ApiBadRequestResponse({
    description: 'Invalid user data or missing idempotency-key header',
  })
  @ApiBody({
    type: CreateUserDto,
    description: 'User data to create a new user',
  })
  create(
    @Body() dto: CreateUserDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @GetUser() requestUser: RequestUser,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException(
        template(I18N_COMMON.ERRORS.IDEMPOTENCY_KEY_REQUIRED),
      );
    }

    return this.usersService.adminCreate(dto, idempotencyKey, requestUser);
  }

  @Get()
  @Roles(...ROLE_GROUPS.COMMON.ADMIN_MANAGEMENT)
  @SkipThrottle()
  @ApiOperation({
    summary: 'Get all users',
    description:
      'Retrieves a cursor-paginated list of users with optional filtering.',
  })
  @ApiOkResponse({
    description: 'List of users retrieved successfully',
    type: PagCursorResultDto,
  })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  findAll(
    @Query() queryDto: UserQueryDto,
    @Query('cursor', CursorParamsPipe) cursor: CursorParams,
  ) {
    return this.usersService.adminFindAll(queryDto, cursor);
  }

  @Get(':id')
  @Roles(...ROLE_GROUPS.COMMON.ADMIN_MANAGEMENT)
  @SkipThrottle()
  @ApiOperation({
    summary: 'Get user by ID',
    description: 'Retrieves a specific user by their unique identifier.',
  })
  @ApiParam({
    name: 'id',
    description: 'User unique identifier (UUID)',
    type: String,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiOkResponse({
    description: 'User found successfully',
    type: UserResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
  })
  @ApiBadRequestResponse({
    description: 'Invalid UUID format',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.adminFindOne(id);
  }

  @Patch(':id')
  @Roles(...ROLE_GROUPS.COMMON.ADMIN_MANAGEMENT)
  @ApiOperation({
    summary: 'Update user information',
    description:
      'Updates user information (name and email only). ' +
      'Use PATCH /users/:id/login to update login credentials.',
  })
  @ApiParam({
    name: 'id',
    description: 'User unique identifier (UUID)',
    type: String,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiOkResponse({
    description: 'User updated successfully',
    type: UserResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
  })
  @ApiConflictResponse({
    description: 'Email already exists',
  })
  @ApiBadRequestResponse({
    description: 'Invalid user data or UUID format',
  })
  @ApiBody({
    type: UpdateUserDto,
    description: 'User data to update (name and email only)',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @GetUser() user: RequestUser,
  ) {
    return this.usersService.adminUpdate(id, updateUserDto, user);
  }

  @Delete(':id')
  @Roles(...ROLE_GROUPS.COMMON.ADMIN_MANAGEMENT)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete user',
    description: 'Deletes a user by their unique identifier.',
  })
  @ApiParam({
    name: 'id',
    description: 'User unique identifier (UUID)',
    type: String,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 204,
    description: 'User deleted successfully',
  })
  @ApiNotFoundResponse({
    description: 'User not found',
  })
  @ApiBadRequestResponse({
    description: 'Invalid UUID format',
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: RequestUser,
  ) {
    await this.usersService.adminRemove(id, user);
  }
}
