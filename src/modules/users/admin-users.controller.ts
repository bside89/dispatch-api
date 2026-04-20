import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Headers,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Post,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiConflictResponse,
  ApiSecurity,
  ApiHeader,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import type { IUsersService } from './interfaces/users-service.interface';
import { USERS_SERVICE } from './constants/users.token';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { BaseController } from '@/shared/controllers/base.controller';
import { GetUser } from '@/shared/decorators/get-user.decorator';
import type { RequestUser } from '../auth/interfaces/request-user.interface';
import { UserMessageFactory } from './factories/user-message.factory';
import { UserRole } from '@/shared/enums/user-role.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { I18N_COMMON } from '@/shared/constants/i18n/i18n-common.constant';
import { template } from '@/shared/helpers/functions';
import { PagOffsetResultDto } from '@/shared/dto/pag-offset-result.dto';

@Controller({ path: 'v1/admin/users', version: '1' })
@ApiTags('users-admin')
@ApiSecurity('bearer')
export class AdminUsersController extends BaseController {
  constructor(
    @Inject(USERS_SERVICE) private readonly usersService: IUsersService,
    private readonly messages: UserMessageFactory,
  ) {
    super(AdminUsersController.name);
  }

  @Post()
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
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
  async create(
    @Body() dto: CreateUserDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @GetUser() requestUser: RequestUser,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException(
        template(I18N_COMMON.ERRORS.IDEMPOTENCY_KEY_REQUIRED),
      );
    }

    const result = await this.usersService.adminCreate(
      dto,
      idempotencyKey,
      requestUser,
    );

    const message = await this.messages.responses.create(result.language);
    return this.success(result, message);
  }

  @Get()
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get all users',
    description:
      'Retrieves a list of all users with optional filtering and pagination.',
  })
  @ApiOkResponse({
    description: 'List of users retrieved successfully',
    type: PagOffsetResultDto<UserResponseDto>,
  })
  async findAll(@Query() queryDto: UserQueryDto) {
    const result = await this.usersService.adminFindAll(queryDto);

    return this.paginateOffset(result);
  }

  @Get(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN)
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
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: RequestUser,
  ) {
    const result = await this.usersService.adminFindOne(id);

    const message = await this.messages.responses.findOne(user.language);
    return this.success(result, message);
  }

  @Patch(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN)
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
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @GetUser() user: RequestUser,
  ) {
    const result = await this.usersService.adminUpdate(id, updateUserDto, user);

    const message = await this.messages.responses.update(user.language);
    return this.success(result, message);
  }

  @Delete(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN)
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

    const message = await this.messages.responses.remove(user.language);
    return this.success(null, message);
  }
}
