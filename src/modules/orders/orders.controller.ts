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
  Logger,
  Req,
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
import { OrderQueryDto } from './dto/order-query.dto';
import { Order } from './entities/order.entity';
import { OrderStatus } from './enums/order-status.enum';
import { UserRole } from '../users/enums/user-role.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaginatedResultDto } from '@/shared/dto/paginated-result.dto';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { GetUser } from '@/shared/decorators/get-user.decorator';

@Controller({ path: 'v1/orders', version: '1' })
@ApiTags('orders')
@ApiSecurity('bearer')
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new order',
    description:
      'Creates a new order with items and adds it to the processing queue. Requires Idempotency-Key header to prevent duplicate orders.',
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
    type: Order,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data or missing Idempotency-Key header',
  })
  @ApiBody({
    type: CreateOrderDto,
    description: 'Order creation data',
  })
  async create(
    @Body() createOrderDto: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @GetUser() user: JwtPayload,
  ): Promise<Order> {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    this.logger.debug(
      `POST /orders - Creating order for user: ${user.sub} with idempotency key: ${idempotencyKey}`,
    );

    return this.ordersService.create(createOrderDto, user.sub, idempotencyKey);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all orders',
    description: 'Retrieve a paginated list of orders with optional filtering',
  })
  @ApiOkResponse({
    description: 'Orders successfully retrieved',
    type: PaginatedResultDto<Order>,
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
  async findAll(
    @Query() queryDto: OrderQueryDto,
  ): Promise<PaginatedResultDto<Order>> {
    this.logger.debug(
      `GET /orders - Fetching orders with filters: ${JSON.stringify(queryDto)}`,
    );
    return this.ordersService.findAll(queryDto);
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
    type: Order,
  })
  @ApiNotFoundResponse({
    description: 'Order not found',
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Order> {
    this.logger.debug(`GET /orders/${id} - Fetching order`);
    return this.ordersService.findOne(id);
  }

  @Patch(':id')
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
    type: Order,
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
  ): Promise<Order> {
    this.logger.debug(`PATCH /orders/${id} - Updating order`);
    return this.ordersService.update(id, updateOrderDto);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Update order status',
    description: 'Update only the order status',
  })
  @ApiParam({
    name: 'id',
    description: 'Order unique identifier (UUID)',
  })
  @ApiOkResponse({
    description: 'Order status successfully updated',
    type: Order,
  })
  @ApiNotFoundResponse({
    description: 'Order not found',
  })
  @ApiBadRequestResponse({
    description: 'Invalid status value',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: Object.values(OrderStatus),
          example: OrderStatus.CONFIRMED,
        },
      },
      required: ['status'],
    },
    description: 'New order status',
  })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: OrderStatus,
  ): Promise<Order> {
    this.logger.debug(
      `PATCH /orders/${id}/status - Updating status to: ${status}`,
    );
    return this.ordersService.updateStatus(id, status);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN) // Only allow users with the ADMIN role to delete orders
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
    type: Order,
  })
  @ApiNotFoundResponse({
    description: 'Order not found',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<Order> {
    this.logger.debug(`DELETE /orders/${id} - Deleting order`);
    return this.ordersService.remove(id);
  }
}
