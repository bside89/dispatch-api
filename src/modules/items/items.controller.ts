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
  ApiParam,
  ApiBody,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiSecurity,
  ApiForbiddenResponse,
  ApiHeader,
} from '@nestjs/swagger';
import { ItemsService } from './items.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ItemQueryDto } from './dto/item-query.dto';
import { ItemResponseDto } from './dto/item-response.dto';
import { UserRole } from '../users/enums/user-role.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaginatedResultDto } from '@/shared/dto/paginated-result.dto';
import { BaseController } from '@/shared/controllers/base.controller';
import { ItemMessageFactory } from './factories/item-message.factory';
import { GetUser } from '@/shared/decorators/get-user.decorator';
import type { RequestUser } from '../auth/interfaces/request-user.interface';
import { I18N_COMMON } from '@/shared/constants/i18n/common.tokens';
import { template } from '@/shared/helpers/functions';

@Controller({ path: 'v1/items', version: '1' })
@ApiTags('items')
@ApiSecurity('bearer')
export class ItemsController extends BaseController {
  constructor(
    private readonly itemsService: ItemsService,
    private readonly messages: ItemMessageFactory,
  ) {
    super(ItemsController.name);
  }

  @Post()
  @Roles(UserRole.ADMIN)
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

    const result = await this.itemsService.create(createItemDto, idempotencyKey);

    const message = await this.messages.responses.create(user.jwtPayload.language);
    return this.success(result, message);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all items',
    description: 'Retrieve a paginated list of items with optional filtering',
  })
  @ApiOkResponse({
    description: 'Items successfully retrieved',
    type: PaginatedResultDto<ItemResponseDto>,
  })
  async findAll(@Query() queryDto: ItemQueryDto) {
    const result = await this.itemsService.findAll(queryDto);

    return this.paginate(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get item by ID' })
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
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: RequestUser,
  ) {
    const result = await this.itemsService.findOne(id);

    const message = await this.messages.responses.findOne(user.jwtPayload.language);
    return this.success(result, message);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
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
    const result = await this.itemsService.update(id, updateItemDto);

    const message = await this.messages.responses.update(user.jwtPayload.language);
    return this.success(result, message);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
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
    await this.itemsService.remove(id);

    const message = await this.messages.responses.remove(user.jwtPayload.language);
    return this.success({}, message);
  }
}
