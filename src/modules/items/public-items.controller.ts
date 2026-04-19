import {
  Controller,
  Get,
  Inject,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiSecurity,
  ApiQuery,
} from '@nestjs/swagger';
import type { IItemsService } from './interfaces/items-service.interface';
import { ITEMS_SERVICE } from './constants/items.token';
import { PublicItemQueryDto } from './dto/item-query.dto';
import { PublicItemResponseDto } from './dto/item-response.dto';
import { PaginatedResultDto } from '@/shared/dto/paginated-result.dto';
import { BaseController } from '@/shared/controllers/base.controller';
import { GetUser } from '@/shared/decorators/get-user.decorator';
import { ItemMessageFactory } from './factories/item-message.factory';
import type { RequestUser } from '../auth/interfaces/request-user.interface';

@Controller({ path: 'v1/items', version: '1' })
@ApiTags('items')
@ApiSecurity('bearer')
export class PublicItemsController extends BaseController {
  constructor(
    @Inject(ITEMS_SERVICE) private readonly itemsService: IItemsService,
    private readonly messages: ItemMessageFactory,
  ) {
    super(PublicItemsController.name);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all items',
    description: 'Retrieve a paginated list of items with optional filtering',
  })
  @ApiOkResponse({
    description: 'Items successfully retrieved',
    type: PaginatedResultDto<PublicItemResponseDto>,
  })
  @ApiQuery({ type: () => PublicItemQueryDto })
  async findAll(@Query() queryDto: PublicItemQueryDto) {
    const result = await this.itemsService.publicFindAll(queryDto);

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
    type: PublicItemResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Item not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: RequestUser,
  ) {
    const result = await this.itemsService.publicFindOne(id);

    const message = await this.messages.responses.findOne(user.language);
    return this.success(result, message);
  }
}
