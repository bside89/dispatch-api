import {
  Controller,
  Get,
  Post,
  Body,
  Param,
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
  ApiHeader,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiSecurity,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import type { IOrdersService } from './interfaces/orders-service.interface';
import { ORDERS_SERVICE } from './constants/orders.token';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderByUserQueryDto } from './dto/order-by-user-query.dto';
import { PagOffsetResultDto } from '@/shared/dto/pag-offset-result.dto';
import { GetUser } from '@/shared/decorators/get-user.decorator';
import { PublicOrderResponseDto } from './dto/order-response.dto';
import { BaseController } from '@/shared/controllers/base.controller';
import type { RequestUser } from '../auth/interfaces/request-user.interface';
import { OrderMessageFactory } from './factories/order-message.factory';
import { template } from '@/shared/utils/functions.utils';
import { I18N_COMMON } from '@/shared/constants/i18n';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { resolveThrottleLimit } from '../../config/throttle.config';

@Controller({ path: 'v1/orders', version: '1' })
@ApiTags('orders')
@ApiSecurity('bearer')
export class PublicOrdersController extends BaseController {
  constructor(
    @Inject(ORDERS_SERVICE) private readonly ordersService: IOrdersService,
    private readonly messages: OrderMessageFactory,
  ) {
    super(PublicOrdersController.name);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: resolveThrottleLimit(10) } })
  @ApiOperation({
    summary: 'Create a new order',
    description:
      'Creates a new order with items and adds it to the processing queue. Requires idempotency-key header to prevent duplicate orders.',
  })
  @ApiHeader({
    name: 'idempotency-key',
    description:
      'Unique key to ensure idempotent requests. Use UUID or any unique string.',
    required: true,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiCreatedResponse({
    description: 'Order successfully created',
    type: PublicOrderResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data or missing idempotency-key header',
  })
  @ApiBody({
    type: CreateOrderDto,
    description: 'Order creation data',
  })
  async create(
    @Body() createOrderDto: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @GetUser() user: RequestUser,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException(
        template(I18N_COMMON.ERRORS.IDEMPOTENCY_KEY_REQUIRED),
      );
    }

    const result = await this.ordersService.publicCreate(
      createOrderDto,
      user.id,
      idempotencyKey,
    );

    const message = await this.messages.responses.create(user.language);
    return this.success(result, message);
  }

  @Get('me')
  @SkipThrottle()
  @ApiOperation({
    summary: 'Get orders for the authenticated user',
    description:
      'Retrieve a paginated list of orders belonging to the authenticated user',
  })
  @ApiOkResponse({
    description: 'Orders successfully retrieved',
    type: PagOffsetResultDto<PublicOrderResponseDto>,
  })
  async findByUser(
    @Query() queryDto: OrderByUserQueryDto,
    @GetUser() user: RequestUser,
  ) {
    const result = await this.ordersService.publicFindByUser(queryDto, user.id);

    return this.paginateOffset(result);
  }

  @Get(':id')
  @SkipThrottle()
  @ApiOperation({
    summary: 'Get order by ID',
    description:
      'Retrieve a specific order by its unique identifier. Only the owner can access their own orders.',
  })
  @ApiParam({
    name: 'id',
    description: 'Order unique identifier (UUID)',
  })
  @ApiOkResponse({
    description: 'Order successfully retrieved',
    type: PublicOrderResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Order not found',
  })
  @ApiForbiddenResponse({
    description: 'Access to this order is not allowed',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: RequestUser,
  ) {
    const result = await this.ordersService.publicFindOne(id, user);

    const message = await this.messages.responses.findOne(user.language);
    return this.success(result, message);
  }
}
