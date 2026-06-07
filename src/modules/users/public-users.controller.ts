import { I18N_COMMON } from '@/shared/constants/i18n';
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
import { Public } from '../auth/decorators/public.decorator';
import type { RequestUser } from '../auth/interfaces/request-user.interface';
import { USERS_SERVICE } from './constants/users.token';
import { PublicCreateUserDto } from './dto/create-user.dto';
import { PublicUpdateUserDto } from './dto/update-user.dto';
import { PublicUserQueryDto } from './dto/user-query.dto';
import { PublicUserResponseDto, UserSelfResponseDto } from './dto/user-response.dto';
import type { IUsersService } from './interfaces/users-service.interface';
@Controller({ path: 'v1/users', version: '1' })
@ApiTags('users')
@ApiSecurity('bearer')
export class PublicUsersController {
  constructor(@Inject(USERS_SERVICE) private readonly usersService: IUsersService) {}

  @Post()
  @Public()
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
  create(
    @Body() dto: PublicCreateUserDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException(
        template(I18N_COMMON.ERRORS.IDEMPOTENCY_KEY_REQUIRED),
      );
    }

    return this.usersService.publicCreate(dto, idempotencyKey);
  }

  @Get()
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
    @Query() queryDto: PublicUserQueryDto,
    @Query('cursor', CursorParamsPipe) cursor: CursorParams,
  ) {
    return this.usersService.publicFindAll(queryDto, cursor);
  }

  @Get('me')
  @SkipThrottle()
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
  findMe(@GetUser() user: RequestUser) {
    return this.usersService.publicFindMe(user);
  }

  @Get(':id')
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
    type: PublicUserResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
  })
  @ApiBadRequestResponse({
    description: 'Invalid UUID format',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.publicFindOne(id);
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
  update(@Body() dto: PublicUpdateUserDto, @GetUser() user: RequestUser) {
    return this.usersService.publicUpdate(dto, user);
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
  }
}
