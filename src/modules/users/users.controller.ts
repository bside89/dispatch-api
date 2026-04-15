import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Headers,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiHeader,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiConflictResponse,
  ApiSecurity,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateLoginDto } from './dto/update-login.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { Public } from '../auth/decorators/public.decorator';
import { UserResponseDto } from './dto/user-response.dto';
import { BaseController } from '@/shared/controllers/base.controller';
import { PaginatedResponseDto } from '@/shared/dto/paginated-response.dto';
import { GetUser } from '@/shared/decorators/get-user.decorator';
import type { RequestUser } from '../auth/interfaces/request-user.interface';
import { UserMessageFactory } from './factories/user-message.factory';
import { I18N_COMMON } from '@/shared/constants/i18n';
import { template } from '@/shared/helpers/functions';

@Controller({ path: 'v1/users', version: '1' })
@ApiTags('users')
@ApiSecurity('bearer')
export class UsersController extends BaseController {
  constructor(
    private readonly usersService: UsersService,
    private readonly messages: UserMessageFactory,
  ) {
    super(UsersController.name);
  }

  @Post()
  @Public()
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
    @Body() createUserDto: CreateUserDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException(
        template(I18N_COMMON.ERRORS.IDEMPOTENCY_KEY_REQUIRED),
      );
    }

    this.logger.debug('POST /users - Creating user', {
      userEmail: createUserDto.email,
      idempotencyKey,
    });

    const result = await this.usersService.create(createUserDto, idempotencyKey);

    const message = await this.messages.responses.create(result.language);
    return this.success(result, message);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all users',
    description:
      'Retrieves a list of all users with optional filtering and pagination.',
  })
  @ApiOkResponse({
    description: 'List of users retrieved successfully',
    type: PaginatedResponseDto<UserResponseDto>,
  })
  @ApiQuery({
    name: 'name',
    required: false,
    description: 'Filter users by name (partial match)',
    type: String,
  })
  @ApiQuery({
    name: 'email',
    required: false,
    description: 'Filter users by email (partial match)',
    type: String,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of users to return',
    type: Number,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Number of users to skip',
    type: Number,
  })
  async findAll(@Query() queryDto: UserQueryDto, @GetUser() user: RequestUser) {
    this.logger.debug('GET /users - Retrieving all users', { query: queryDto });

    const result = await this.usersService.findAll(queryDto, user);

    return this.paginate(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
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
    this.logger.debug(`GET /users/${id} - Retrieving user`, { userId: id });

    const result = await this.usersService.findOne(id, user);

    const message = await this.messages.responses.findOne(result.language);
    return this.success(result, message);
  }

  @Patch(':id')
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
    this.logger.debug(`PATCH /users/${id} - Updating user`, {
      userId: id,
    });

    const result = await this.usersService.update(id, updateUserDto, user);

    const message = await this.messages.responses.update(result.language);
    return this.success(result, message);
  }

  @Patch(':id/login')
  @ApiOperation({
    summary: 'Update user login credentials',
    description:
      'Updates user email and/or password. ' +
      'Current password is required when changing password.',
  })
  @ApiParam({
    name: 'id',
    description: 'User unique identifier (UUID)',
    type: String,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiOkResponse({
    description: 'Login credentials updated successfully',
    type: UserResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
  })
  @ApiConflictResponse({
    description: 'Email already exists',
  })
  @ApiBadRequestResponse({
    description:
      'Invalid data, missing current password, or incorrect current password',
  })
  @ApiBody({
    type: UpdateLoginDto,
    description: 'Login credentials to update',
  })
  async updateLogin(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateLoginDto: UpdateLoginDto,
    @GetUser() user: RequestUser,
  ) {
    this.logger.debug(`PATCH /users/${id}/login - Updating user login credentials`, {
      userId: id,
    });

    const result = await this.usersService.updateLogin(id, updateLoginDto, user);

    const message = await this.messages.responses.updateLogin(result.language);
    return this.success(result, message);
  }

  @Delete(':id')
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
    this.logger.debug(`DELETE /users/${id} - Deleting user`, { userId: id });

    await this.usersService.remove(id, user);

    const message = await this.messages.responses.remove(user.jwtPayload.language);
    return this.success(null, message);
  }
}
