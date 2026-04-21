import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiSecurity,
  ApiResponse,
} from '@nestjs/swagger';
import type { IOrdersService } from './interfaces/orders-service.interface';
import { ORDERS_SERVICE } from './constants/orders.token';
import { UpdateOrderDto } from './dto/update-order.dto';
import { ShipOrderDto } from './dto/ship-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { ROLE_GROUPS } from '@/shared/constants/role-groups.constant';
import { PagOffsetResultDto } from '@/shared/dto/pag-offset-result.dto';
import { GetUser } from '@/shared/decorators/get-user.decorator';
import { OrderResponseDto } from './dto/order-response.dto';
import { BaseController } from '@/shared/controllers/base.controller';
import { ErrorResponseDto } from '@/shared/dto/error-response.dto';
import type { RequestUser } from '../auth/interfaces/request-user.interface';
import { OrderMessageFactory } from './factories/order-message.factory';

@Controller({ path: 'v1/admin/orders', version: '1' })
@ApiTags('orders-admin')
@ApiSecurity('bearer')
export class AdminOrdersController extends BaseController {
  constructor(
    @Inject(ORDERS_SERVICE) private readonly ordersService: IOrdersService,
    private readonly messages: OrderMessageFactory,
  ) {
    super(AdminOrdersController.name);
  }

  @Get()
  @Roles(...ROLE_GROUPS.ORDER_FINANCIAL)
  @ApiOperation({
    summary: 'Get all orders',
    description: 'Retrieve a paginated list of orders with optional filtering',
  })
  @ApiOkResponse({
    description: 'Orders successfully retrieved',
    type: PagOffsetResultDto<OrderResponseDto>,
  })
  async findAll(@Query() queryDto: OrderQueryDto) {
    const result = await this.ordersService.adminFindAll(queryDto);

    return this.paginateOffset(result);
  }

  @Get(':id')
  @Roles(...ROLE_GROUPS.ORDER_FINANCIAL)
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
    const result = await this.ordersService.adminFindOne(id);

    const message = await this.messages.responses.findOne(user.language);
    return this.success(result, message);
  }

  @Patch(':id')
  @Roles(...ROLE_GROUPS.ORDER_MANAGEMENT)
  @ApiOperation({
    summary: 'Update an order',
    description: 'Update order details including status',
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
    const result = await this.ordersService.adminUpdate(id, updateOrderDto);

    const message = await this.messages.responses.update(
      user.language,
      result.status,
    );
    return this.success(result, message);
  }

  @Delete(':id')
  @Roles(...ROLE_GROUPS.ORDER_MANAGEMENT)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete an order',
    description: 'Soft-deletes an order by deactivating it',
  })
  @ApiParam({
    name: 'id',
    description: 'Order unique identifier (UUID)',
  })
  @ApiResponse({
    status: 204,
    description: 'Order successfully deleted',
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
    await this.ordersService.adminRemove(id);

    const message = await this.messages.responses.remove(user.language);
    return this.success({}, message);
  }

  @Patch(':id/ship')
  @Roles(...ROLE_GROUPS.ORDER_SHIPPING)
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
    const result = await this.ordersService.ship(id, shipOrderDto);

    const message = await this.messages.responses.ship(user.language);
    return this.success(result, message);
  }

  @Patch(':id/deliver')
  @Roles(...ROLE_GROUPS.ORDER_DELIVERY)
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
    const result = await this.ordersService.deliver(id);

    const message = await this.messages.responses.deliver(user.language);
    return this.success(result, message);
  }

  @Patch(':id/cancel')
  @Roles(...ROLE_GROUPS.ORDER_FINANCIAL)
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
    await this.ordersService.cancel(id);

    const message = await this.messages.responses.cancel(user.language);
    return this.success({}, message);
  }

  @Patch(':id/refund')
  @Roles(...ROLE_GROUPS.ORDER_FINANCIAL)
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
    await this.ordersService.refund(id);

    const message = await this.messages.responses.refund(user.language);
    return this.success({}, message);
  }
}
