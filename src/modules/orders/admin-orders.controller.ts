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
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { UpdateOrderDto } from './dto/update-order.dto';
import { ShipOrderDto } from './dto/ship-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { UserRole } from '../../shared/enums/user-role.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaginatedResultDto } from '@/shared/dto/paginated-result.dto';
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
    private readonly ordersService: OrdersService,
    private readonly messages: OrderMessageFactory,
  ) {
    super(AdminOrdersController.name);
  }

  @Get()
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.FINANCIAL)
  @ApiOperation({
    summary: 'Get all orders',
    description: 'Retrieve a paginated list of orders with optional filtering',
  })
  @ApiOkResponse({
    description: 'Orders successfully retrieved',
    type: PaginatedResultDto<OrderResponseDto>,
  })
  @ApiQuery({ type: () => OrderQueryDto })
  async findAll(@Query() queryDto: OrderQueryDto) {
    const result = await this.ordersService.adminFindAll(queryDto);

    return this.paginate(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.FINANCIAL)
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

    const message = await this.messages.responses.findOne(user.jwtPayload.language);
    return this.success(result, message);
  }

  @Patch(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN)
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
      user.jwtPayload.language,
      result.status,
    );
    return this.success(result, message);
  }

  @Delete(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN)
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

    const message = await this.messages.responses.remove(user.jwtPayload.language);
    return this.success({}, message);
  }

  @Patch(':id/ship')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.SHIPPER)
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

    const message = await this.messages.responses.ship(user.jwtPayload.language);
    return this.success(result, message);
  }

  @Patch(':id/deliver')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.DELIVERY)
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

    const message = await this.messages.responses.deliver(user.jwtPayload.language);
    return this.success(result, message);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.FINANCIAL)
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

    const message = await this.messages.responses.cancel(user.jwtPayload.language);
    return this.success({}, message);
  }

  @Patch(':id/refund')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.FINANCIAL)
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

    const message = await this.messages.responses.refund(user.jwtPayload.language);
    return this.success({}, message);
  }
}
