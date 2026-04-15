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
  ApiQuery,
  ApiBody,
  ApiHeader,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiSecurity,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { ShipOrderDto } from './dto/ship-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { OrderStatus } from './enums/order-status.enum';
import { UserRole } from '../users/enums/user-role.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaginatedResultDto } from '@/shared/dto/paginated-result.dto';
import { GetUser } from '@/shared/decorators/get-user.decorator';
import { OrderResponseDto } from './dto/order-response.dto';
import { BaseController } from '@/shared/controllers/base.controller';
import { ErrorResponseDto } from '@/shared/dto/error-response.dto';
import type { RequestUser } from '../auth/interfaces/request-user.interface';
import { OrderMessageFactory } from './factories/order-message.factory';
import { template } from '@/shared/helpers/functions';
import { I18N_COMMON } from '@/shared/constants/i18n/common.tokens';

@Controller({ path: 'v1/orders', version: '1' })
@ApiTags('orders')
@ApiSecurity('bearer')
export class OrdersController extends BaseController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly messages: OrderMessageFactory,
  ) {
    super(OrdersController.name);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
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
    type: OrderResponseDto,
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

    this.logger.debug('POST /orders - Creating order', {
      userId: user.id,
      idempotencyKey,
    });

    const result = await this.ordersService.create(
      createOrderDto,
      user.id,
      idempotencyKey,
    );

    const message = await this.messages.responses.create(user.jwtPayload.language);
    return this.success(result, message);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all orders',
    description: 'Retrieve a paginated list of orders with optional filtering',
  })
  @ApiOkResponse({
    description: 'Orders successfully retrieved',
    type: PaginatedResultDto<OrderResponseDto>,
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'Filter orders by user ID',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: OrderStatus,
    description: 'Filter orders by status',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Filter orders from this date (ISO string)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'Filter orders until this date (ISO string)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (default: 10)',
  })
  async findAll(@Query() queryDto: OrderQueryDto, @GetUser() user: RequestUser) {
    this.logger.debug(`GET /orders - Fetching orders with filters`, { queryDto });

    const result = await this.ordersService.findAll(queryDto, user);

    return this.paginate(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get order by ID',
    description: 'Retrieve a specific order by its unique identifier',
  })
  @ApiParam({
    name: 'id',
    description: 'Order unique identifier (UUID)',
  })
  @ApiOkResponse({
    description: 'Order successfully retrieved',
    type: OrderResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Order not found',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: RequestUser,
  ) {
    this.logger.debug(`GET /orders/${id} - Fetching order`, { orderId: id });

    const result = await this.ordersService.findOne(id, user);

    const message = await this.messages.responses.findOne(user.jwtPayload.language);
    return this.success(result, message);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update an order',
    description: 'Update order details including status and items',
  })
  @ApiParam({
    name: 'id',
    description: 'Order unique identifier (UUID)',
  })
  @ApiOkResponse({
    description: 'Order successfully updated',
    type: OrderResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Order not found',
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data',
  })
  @ApiBody({
    type: UpdateOrderDto,
    description: 'Order update data',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateOrderDto: UpdateOrderDto,
    @GetUser() user: RequestUser,
  ) {
    this.logger.debug(`PATCH /orders/${id} - Updating order`, {
      orderId: id,
      updateOrderDto,
    });

    const result = await this.ordersService.update(id, updateOrderDto);

    const message = await this.messages.responses.update(
      user.jwtPayload.language,
      result.status,
    );
    return this.success(result, message);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete an order',
    description: 'Delete an order and all its items',
  })
  @ApiParam({
    name: 'id',
    description: 'Order unique identifier (UUID)',
  })
  @ApiOkResponse({
    description: 'Order successfully deleted',
    type: OrderResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Order not found',
    type: ErrorResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid UUID format',
    type: ErrorResponseDto,
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: RequestUser,
  ) {
    this.logger.debug(`DELETE /orders/${id} - Deleting order`, { orderId: id });

    await this.ordersService.remove(id);

    const message = await this.messages.responses.remove(user.jwtPayload.language);
    return this.success(null, message);
  }

  @Patch(':id/ship')
  @Roles(UserRole.ADMIN, UserRole.SHIPPER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark order as shipped',
    description:
      'Marks an order as shipped. The order must be in PROCESSED status. ' +
      'Optionally accepts tracking number and carrier information.',
  })
  @ApiParam({ name: 'id', description: 'Order unique identifier (UUID)' })
  @ApiBody({ type: ShipOrderDto, description: 'Shipping information' })
  @ApiOkResponse({
    description: 'Order successfully marked as shipped',
    type: OrderResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiBadRequestResponse({
    description: 'Order is not in a valid status for shipping',
  })
  async ship(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() shipOrderDto: ShipOrderDto,
    @GetUser() user: RequestUser,
  ) {
    this.logger.debug(`PATCH /orders/${id}/ship - Shipping order`, { orderId: id });

    const result = await this.ordersService.ship(id, shipOrderDto);

    const message = await this.messages.responses.ship(user.jwtPayload.language);
    return this.success(result, message);
  }

  @Patch(':id/deliver')
  @Roles(UserRole.ADMIN, UserRole.DELIVERY)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark order as delivered',
    description: 'Marks an order as delivered. The order must be in SHIPPED status.',
  })
  @ApiParam({ name: 'id', description: 'Order unique identifier (UUID)' })
  @ApiOkResponse({
    description: 'Order successfully marked as delivered',
    type: OrderResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiBadRequestResponse({
    description: 'Order is not in a valid status for delivery',
  })
  async deliver(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: RequestUser,
  ) {
    this.logger.debug(`PATCH /orders/${id}/deliver - Delivering order`, {
      orderId: id,
    });

    const result = await this.ordersService.deliver(id);

    const message = await this.messages.responses.deliver(user.jwtPayload.language);
    return this.success(result, message);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel an order',
    description:
      'Cancels an order and releases reserved inventory. ' +
      'The order must be in PENDING, PAID, or PROCESSED status.',
  })
  @ApiParam({ name: 'id', description: 'Order unique identifier (UUID)' })
  @ApiOkResponse({ description: 'Order cancellation enqueued successfully' })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiBadRequestResponse({
    description: 'Order is not in a valid status for cancellation',
  })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: RequestUser,
  ) {
    this.logger.debug(`PATCH /orders/${id}/cancel - Cancelling order`, {
      orderId: id,
    });

    await this.ordersService.cancel(id);

    const message = await this.messages.responses.cancel(user.jwtPayload.language);
    return this.success(null, message);
  }

  @Patch(':id/refund')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refund an order',
    description:
      'Initiates a refund for an order. ' +
      'The order must be in PAID, PROCESSED, SHIPPED, or DELIVERED status.',
  })
  @ApiParam({ name: 'id', description: 'Order unique identifier (UUID)' })
  @ApiOkResponse({ description: 'Order refund enqueued successfully' })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiBadRequestResponse({
    description: 'Order is not in a valid status for refunding',
  })
  async refund(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: RequestUser,
  ) {
    this.logger.debug(`PATCH /orders/${id}/refund - Refunding order`, {
      orderId: id,
    });

    await this.ordersService.refund(id);

    const message = await this.messages.responses.refund(user.jwtPayload.language);
    return this.success(null, message);
  }
}
