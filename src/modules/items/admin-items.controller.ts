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
  ApiParam,
  ApiBody,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiSecurity,
  ApiForbiddenResponse,
  ApiHeader,
  ApiQuery,
} from '@nestjs/swagger';
import type { IItemsService } from './interfaces/items-service.interface';
import { ITEMS_SERVICE } from './constants/items.token';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ItemQueryDto } from './dto/item-query.dto';
import { ItemResponseDto } from './dto/item-response.dto';
import { UserRole } from '../../shared/enums/user-role.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import { PagOffsetResultDto } from '@/shared/dto/pag-offset-result.dto';
import { BaseController } from '@/shared/controllers/base.controller';
import { GetUser } from '@/shared/decorators/get-user.decorator';
import { ItemMessageFactory } from './factories/item-message.factory';
import type { RequestUser } from '../auth/interfaces/request-user.interface';
import { I18N_COMMON } from '@/shared/constants/i18n';
import { template } from '@/shared/utils/functions.utils';

@Controller({ path: 'v1/admin/items', version: '1' })
@ApiTags('items-admin')
@ApiSecurity('bearer')
export class AdminItemsController extends BaseController {
  constructor(
    @Inject(ITEMS_SERVICE) private readonly itemsService: IItemsService,
    private readonly messages: ItemMessageFactory,
  ) {
    super(AdminItemsController.name);
  }

  @Post()
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new item',
    description:
      'Creates a new catalog item. Requires admin role. ' +
      'Requires idempotency-key header to prevent duplicate items.',
  })
  @ApiHeader({
    name: 'idempotency-key',
    description:
      'Unique key to ensure idempotent requests. Use UUID or any unique string.',
    required: true,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiCreatedResponse({
    description: 'Item successfully created',
    type: ItemResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  @ApiForbiddenResponse({ description: 'Requires admin role' })
  @ApiBody({ type: CreateItemDto, description: 'Item creation data' })
  async create(
    @Body() createItemDto: CreateItemDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @GetUser() user: RequestUser,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException(
        template(I18N_COMMON.ERRORS.IDEMPOTENCY_KEY_REQUIRED),
      );
    }

    const result = await this.itemsService.adminCreate(
      createItemDto,
      idempotencyKey,
    );

    const message = await this.messages.responses.create(user.language);
    return this.success(result, message);
  }

  @Get()
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get all items (admin)',
    description:
      'Retrieve a paginated list of items with full details including payment gateway price ID.',
  })
  @ApiOkResponse({
    description: 'Items successfully retrieved',
    type: PagOffsetResultDto<ItemResponseDto>,
  })
  @ApiQuery({ type: () => ItemQueryDto })
  async findAll(@Query() queryDto: ItemQueryDto) {
    const result = await this.itemsService.adminFindAll(queryDto);

    return this.paginateOffset(result);
  }

  @Get(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get item by ID (admin)' })
  @ApiParam({
    name: 'id',
    description: 'Item unique identifier (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiOkResponse({
    description: 'Item successfully retrieved',
    type: ItemResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Item not found' })
  @ApiForbiddenResponse({ description: 'Requires admin role' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: RequestUser,
  ) {
    const result = await this.itemsService.adminFindOne(id);

    const message = await this.messages.responses.findOne(user.language);
    return this.success(result, message);
  }

  @Patch(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update an item', description: 'Requires admin role.' })
  @ApiParam({
    name: 'id',
    description: 'Item unique identifier (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiOkResponse({
    description: 'Item successfully updated',
    type: ItemResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Item not found' })
  @ApiForbiddenResponse({ description: 'Requires admin role' })
  @ApiBody({ type: UpdateItemDto, description: 'Item update data' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateItemDto: UpdateItemDto,
    @GetUser() user: RequestUser,
  ) {
    const result = await this.itemsService.adminUpdate(id, updateItemDto);

    const message = await this.messages.responses.update(user.language);
    return this.success(result, message);
  }

  @Delete(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an item', description: 'Requires admin role.' })
  @ApiParam({
    name: 'id',
    description: 'Item unique identifier (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiOkResponse({ description: 'Item successfully deleted' })
  @ApiNotFoundResponse({ description: 'Item not found' })
  @ApiForbiddenResponse({ description: 'Requires admin role' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: RequestUser,
  ) {
    await this.itemsService.adminRemove(id);

    const message = await this.messages.responses.remove(user.language);
    return this.success({}, message);
  }
}
