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
  Inject,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiHeader,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiConflictResponse,
  ApiSecurity,
} from '@nestjs/swagger';
import type { IUsersService } from './interfaces/users-service.interface';
import { USERS_SERVICE } from './constants/users.token';
import { PublicCreateUserDto } from './dto/create-user.dto';
import { PublicUpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { Public } from '../auth/decorators/public.decorator';
import { PublicUserResponseDto, UserSelfResponseDto } from './dto/user-response.dto';
import { BaseController } from '@/shared/controllers/base.controller';
import { GetUser } from '@/shared/decorators/get-user.decorator';
import type { RequestUser } from '../auth/interfaces/request-user.interface';
import { UserMessageFactory } from './factories/user-message.factory';
import { I18N_COMMON } from '@/shared/constants/i18n';
import { template } from '@/shared/helpers/functions';
import { PaginatedResultDto } from '@/shared/dto/paginated-result.dto';

@Controller({ path: 'v1/users', version: '1' })
@ApiTags('users')
@ApiSecurity('bearer')
export class PublicUsersController extends BaseController {
  constructor(
    @Inject(USERS_SERVICE) private readonly usersService: IUsersService,
    private readonly messages: UserMessageFactory,
  ) {
    super(PublicUsersController.name);
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
    type: UserSelfResponseDto,
  })
  @ApiConflictResponse({
    description: 'Email already exists',
  })
  @ApiBadRequestResponse({
    description: 'Invalid user data or missing idempotency-key header',
  })
  @ApiBody({
    type: PublicCreateUserDto,
    description: 'User data to create a new user',
  })
  async create(
    @Body() dto: PublicCreateUserDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException(
        template(I18N_COMMON.ERRORS.IDEMPOTENCY_KEY_REQUIRED),
      );
    }

    const result = await this.usersService.publicCreate(dto, idempotencyKey);

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
    type: PaginatedResultDto<PublicUserResponseDto>,
  })
  async findAll(@Query() queryDto: UserQueryDto) {
    const result = await this.usersService.publicFindAll(queryDto);

    return this.paginate(result.data, result.total, result.page, result.limit);
  }

  @Get('me')
  @ApiOperation({
    summary: 'Get current user',
    description: "Retrieves the authenticated user's information.",
  })
  @ApiOkResponse({
    description: 'User information retrieved successfully',
    type: UserSelfResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
  })
  async findMe(@GetUser() user: RequestUser) {
    const result = await this.usersService.publicFindMe(user);

    const message = await this.messages.responses.findOne(user.language);
    return this.success(result, message);
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
    type: PublicUserResponseDto,
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
    const result = await this.usersService.publicFindOne(id);

    const message = await this.messages.responses.findOne(user.language);
    return this.success(result, message);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Update current user information',
    description: 'Updates the authenticated user information',
  })
  @ApiOkResponse({
    description: 'User updated successfully',
    type: UserSelfResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
  })
  @ApiConflictResponse({
    description: 'Email already exists',
  })
  @ApiBody({
    type: PublicUpdateUserDto,
    description: 'User data to update',
  })
  async update(@Body() dto: PublicUpdateUserDto, @GetUser() user: RequestUser) {
    const result = await this.usersService.publicUpdate(dto, user);

    const message = await this.messages.responses.update(user.language);
    return this.success(result, message);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete current user',
    description: 'Deletes the authenticated user.',
  })
  @ApiResponse({
    status: 204,
    description: 'User deleted successfully',
  })
  @ApiNotFoundResponse({
    description: 'User not found',
  })
  async remove(@GetUser() user: RequestUser) {
    await this.usersService.publicRemove(user);

    const message = await this.messages.responses.remove(user.language);
    return this.success(null, message);
  }
}
