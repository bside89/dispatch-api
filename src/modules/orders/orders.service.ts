import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { User } from '../users/entities/user.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { OrderStatus } from './enums/order-status.enum';
import { IDEMPOTENCY_SERVICE } from '../../shared/modules/cache/constants/idempotency.token';
import type { IIdempotencyService } from '../../shared/modules/cache/interfaces/idempotency-service.interface';
import { NotifyUserJobPayload } from '@/shared/payloads/side-effects-job.payload';
import type { IOrderRepository } from './interfaces/order-repository.interface';
import { ORDER_REPOSITORY } from './constants/orders.token';
import type { IOrderItemRepository } from './interfaces/order-item-repository.interface';
import { ORDER_ITEM_REPOSITORY } from './constants/orders.token';
import { PagOffsetResultDto } from '@/shared/dto/pag-offset-result.dto';
import {
  OrderPaymentDto,
  OrderResponseDto,
  PublicOrderResponseDto,
} from './dto/order-response.dto';
import { EntityMapper } from '@/shared/utils/entity-mapper.utils';
import type { IOutboxService } from '@/shared/modules/outbox/interfaces/outbox-service.interface';
import { OUTBOX_SERVICE } from '@/shared/modules/outbox/constants/outbox.token';
import {
  ProcessOrderJobPayload,
  CancelOrderJobPayload,
  RefundOrderJobPayload,
} from '@/shared/payloads/orders-job.payload';
import { ShipOrderDto } from './dto/ship-order.dto';
import { UpdateOrderPaymentDto } from './dto/order-payment.dto';
import { template } from '@/shared/utils/functions.utils';
import { ORDER_KEY } from '../../shared/modules/cache/constants/order.key';
import type { RequestUser } from '../auth/interfaces/request-user.interface';
import { LOCK_KEY } from '@/shared/constants/lock.key';
import type { IItemsService } from '../items/interfaces/items-service.interface';
import { ITEMS_SERVICE } from '../items/constants/items.token';
import type { IPaymentsGatewayService } from '../payments-gateway/interfaces/payments-gateway-service.interface';
import { PAYMENTS_GATEWAY_SERVICE } from '../payments-gateway/constants/payments-gateway.token';
import { OrderMessageFactory } from './factories/order-message.factory';
import { I18N_ORDERS } from '@/shared/constants/i18n';
import {
  languageToCurrency,
  languageToLocale,
  toCurrencyFormatted,
} from './helpers/order-functions';
import { OrderByUserQueryDto } from './dto/order-by-user-query.dto';
import { IOrdersService } from './interfaces/orders-service.interface';
import { BaseService } from '@/shared/services/base.service';
import { DbGuardService } from '@/shared/modules/db-guard/db-guard.service';
import { OrderTransitionPolicy } from './helpers/order-transition-policy';
import { Order } from './entities/order.entity';
import { GatewayPaymentParams } from '../payments-gateway/interfaces/gateway-payment-params.interface';

@Injectable()
export class OrdersService extends BaseService implements IOrdersService {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orderRepository: IOrderRepository,
    @Inject(ORDER_ITEM_REPOSITORY)
    private readonly orderItemRepository: IOrderItemRepository,
    @Inject(ITEMS_SERVICE) private readonly itemsService: IItemsService,
    @Inject(OUTBOX_SERVICE) private readonly outboxService: IOutboxService,
    @Inject(PAYMENTS_GATEWAY_SERVICE)
    private readonly paymentsGatewayService: IPaymentsGatewayService,
    @Inject(IDEMPOTENCY_SERVICE)
    private readonly idempotencyService: IIdempotencyService,
    private readonly messages: OrderMessageFactory,
    private readonly guard: DbGuardService,
  ) {
    super(OrdersService.name);
  }

  //#region Public endpoints

  publicCreate(
    dto: CreateOrderDto,
    userId: string,
    idempotencyKey: string,
  ): Promise<PublicOrderResponseDto> {
    return this.guard.lockAndTransaction(
      LOCK_KEY.ORDER.CREATE(idempotencyKey),
      async () => this._publicCreate(dto, userId, idempotencyKey),
    );
  }

  private async _publicCreate(
    dto: CreateOrderDto,
    userId: string,
    idempotencyKey: string,
  ): Promise<PublicOrderResponseDto> {
    const idempotencyKeyFormatted = ORDER_KEY.IDEMPOTENCY('create', idempotencyKey);

    return this.idempotencyService.getOrExecute(idempotencyKeyFormatted, async () =>
      this._publicCreateWithIdempotency(dto, userId, idempotencyKeyFormatted),
    );
  }

  private async _publicCreateWithIdempotency(
    dto: CreateOrderDto,
    userId: string,
    idempotencyKey: string,
  ): Promise<PublicOrderResponseDto> {
    const catalogItems = await this.itemsService.validateAndGetCatalogItems(
      dto.items.map((i) => i.itemId),
    );
    const savedOrder = await this.createOrderWithItems(dto, userId, catalogItems);

    await this.decrementItemsStock(dto, catalogItems);

    const completeOrder = await this.getOrderOrThrow(savedOrder.id);

    const paymentIntentParams = this.buildPaymentParams(completeOrder, userId);
    const paymentIntent = await this.paymentsGatewayService.paymentsCreate(
      paymentIntentParams,
      idempotencyKey,
    );

    completeOrder.paymentId = paymentIntent.id;
    completeOrder.paymentStatus = paymentIntent.status;
    await this.orderRepository.save(completeOrder);

    await this.dispatchOrderCreatedNotification(
      completeOrder.user,
      completeOrder.total,
    );

    const orderMapped = EntityMapper.map(completeOrder, PublicOrderResponseDto);
    orderMapped.paymentData = EntityMapper.map(paymentIntent, OrderPaymentDto);

    this.logger.debug('Order created', {
      idempotencyKey: idempotencyKey,
      orderId: completeOrder.id,
    });

    return orderMapped;
  }

  async publicFindByUser(
    queryDto: OrderByUserQueryDto,
    userId: string,
  ): Promise<PagOffsetResultDto<PublicOrderResponseDto>> {
    const result = await this.orderRepository.filter({ ...queryDto, userId });

    this.logger.debug(`Found ${result.items.length} orders for user ${userId}`, {
      page: queryDto.page,
      totalPages: result.meta.totalPages,
    });

    return new PagOffsetResultDto<PublicOrderResponseDto>(
      result.meta.total,
      result.meta.page,
      result.meta.limit,
      EntityMapper.mapArray(result.items, PublicOrderResponseDto),
    );
  }

  async publicFindOne(
    id: string,
    requestUser: RequestUser,
  ): Promise<PublicOrderResponseDto> {
    const order = await this.getOrderOrThrow(id);

    if (order.userId !== requestUser.id) {
      throw new ForbiddenException(template(I18N_ORDERS.ERRORS.ACCESS_DENIED));
    }

    const paymentIntent = await this.paymentsGatewayService.paymentsRetrieve(
      order.paymentId,
    );

    const orderMapped = EntityMapper.map(order, PublicOrderResponseDto);
    orderMapped.paymentData = EntityMapper.map(paymentIntent, OrderPaymentDto);

    this.logger.debug('Found order', { orderId: id });

    return orderMapped;
  }

  //#endregion

  //#region Admin endpoints

  async adminFindAll(
    queryDto: OrderQueryDto,
  ): Promise<PagOffsetResultDto<OrderResponseDto>> {
    const result = await this.orderRepository.filter(queryDto);

    this.logger.debug(`Found ${result.items.length} orders`, {
      page: queryDto.page,
      totalPages: result.meta.totalPages,
    });

    return new PagOffsetResultDto<OrderResponseDto>(
      result.meta.total,
      result.meta.page,
      result.meta.limit,
      EntityMapper.mapArray(result.items, OrderResponseDto),
    );
  }

  async adminFindOne(id: string): Promise<OrderResponseDto> {
    const order = await this.getOrderOrThrow(id);

    const paymentIntent = await this.paymentsGatewayService.paymentsRetrieve(
      order.paymentId,
    );

    const orderMapped = EntityMapper.map(order, OrderResponseDto);
    orderMapped.paymentData = EntityMapper.map(paymentIntent, OrderPaymentDto);

    this.logger.debug('Found order', { orderId: id });

    return orderMapped;
  }

  adminUpdate(id: string, dto: UpdateOrderDto): Promise<OrderResponseDto> {
    return this.guard.lockAndTransaction(LOCK_KEY.ORDER.UPDATE(id), async () =>
      this._adminUpdate(id, dto),
    );
  }

  private async _adminUpdate(
    id: string,
    dto: UpdateOrderDto,
  ): Promise<OrderResponseDto> {
    const order = await this.getOrderOrThrow(id);

    Object.assign(order, dto);
    await this.orderRepository.save(order);

    const message = await this.messages.notifications.orderUpdated(
      order.user.language,
      order.status,
    );
    await this.dispatchNotification(order.user, message);

    this.logger.debug('Order updated', { orderId: id });

    return EntityMapper.map(order, OrderResponseDto);
  }

  adminRemove(id: string): Promise<void> {
    return this.guard.lockAndTransaction(LOCK_KEY.ORDER.REMOVE(id), async () =>
      this._adminRemove(id),
    );
  }

  private async _adminRemove(id: string): Promise<void> {
    const order = await this.getOrderOrThrow(id);

    await this.orderRepository.softDelete(order);

    this.logger.debug('Order deactivated', { orderId: id });
  }

  ship(id: string, dto: ShipOrderDto): Promise<OrderResponseDto> {
    return this.guard.lockAndTransaction(LOCK_KEY.ORDER.UPDATE(id), async () =>
      this._ship(id, dto),
    );
  }

  private async _ship(id: string, dto: ShipOrderDto): Promise<OrderResponseDto> {
    const order = await this.getOrderOrThrow(id);

    if (!OrderTransitionPolicy.canTransition(order.status, OrderStatus.SHIPPED)) {
      throw new BadRequestException(
        template(I18N_ORDERS.ERRORS.BAD_PRECONDITIONS, {
          status: OrderStatus.SHIPPED,
          currentStatus: order.status,
        }),
      );
    }

    order.status = OrderStatus.SHIPPED;
    order.shippedAt = new Date();
    if (dto.trackingNumber !== undefined) order.trackingNumber = dto.trackingNumber;
    if (dto.carrier !== undefined) order.carrier = dto.carrier;

    await this.orderRepository.save(order);

    const message = await this.messages.notifications.orderShipped(
      order.user.language,
    );
    await this.dispatchNotification(order.user, message);

    this.logger.debug('Order shipped', { orderId: id });

    return EntityMapper.map(order, OrderResponseDto);
  }

  deliver(id: string): Promise<OrderResponseDto> {
    return this.guard.lockAndTransaction(LOCK_KEY.ORDER.UPDATE(id), async () =>
      this._deliver(id),
    );
  }

  private async _deliver(id: string): Promise<OrderResponseDto> {
    const order = await this.getOrderOrThrow(id);

    if (!OrderTransitionPolicy.canTransition(order.status, OrderStatus.DELIVERED)) {
      throw new BadRequestException(
        template(I18N_ORDERS.ERRORS.BAD_PRECONDITIONS, {
          status: OrderStatus.DELIVERED,
          currentStatus: order.status,
        }),
      );
    }

    order.status = OrderStatus.DELIVERED;
    order.deliveredAt = new Date();

    await this.orderRepository.save(order);

    const message = await this.messages.notifications.orderDelivered(
      order.user.language,
    );
    await this.dispatchNotification(order.user, message);

    this.logger.debug('Order delivered', { orderId: id });
    return EntityMapper.map(order, OrderResponseDto);
  }

  cancel(id: string): Promise<void> {
    return this.guard.lockAndTransaction(LOCK_KEY.ORDER.UPDATE(id), async () =>
      this._cancel(id),
    );
  }

  private async _cancel(id: string): Promise<void> {
    const order = await this.getOrderOrThrow(id);

    if (!OrderTransitionPolicy.canTransition(order.status, OrderStatus.CANCELED)) {
      throw new BadRequestException(
        template(I18N_ORDERS.ERRORS.BAD_PRECONDITIONS, {
          status: OrderStatus.CANCELED,
          currentStatus: order.status,
        }),
      );
    }

    await this.outboxService.add(new CancelOrderJobPayload(id));

    this.logger.debug('Order cancel enqueued', { orderId: id });
  }

  refund(id: string): Promise<void> {
    return this.guard.lockAndTransaction(LOCK_KEY.ORDER.UPDATE(id), async () =>
      this._refund(id),
    );
  }

  private async _refund(id: string): Promise<void> {
    const order = await this.getOrderOrThrow(id);

    if (!OrderTransitionPolicy.canTransition(order.status, OrderStatus.REFUNDED)) {
      throw new BadRequestException(
        template(I18N_ORDERS.ERRORS.BAD_PRECONDITIONS, {
          status: OrderStatus.REFUNDED,
          currentStatus: order.status,
        }),
      );
    }

    await this.outboxService.add(new RefundOrderJobPayload(id));

    this.logger.debug('Order refund enqueued', { orderId: id });
  }

  //#endregion

  //#region Webhook methods

  markPaymentAsSucceeded(dto: UpdateOrderPaymentDto): Promise<OrderResponseDto> {
    return this.guard.lockAndTransaction(
      LOCK_KEY.ORDER.UPDATE(dto.orderId),
      async () => this._markPaymentAsSucceeded(dto),
    );
  }

  private async _markPaymentAsSucceeded(
    dto: UpdateOrderPaymentDto,
  ): Promise<OrderResponseDto> {
    const order = await this.getOrderOrThrow(dto.orderId);

    order.paymentId = dto.paymentId;
    order.paymentStatus = dto.paymentStatus;
    order.status = OrderStatus.PAID;

    await this.orderRepository.save(order);

    // Kick off the order processing pipeline
    await this.outboxService.add(new ProcessOrderJobPayload(dto.orderId));

    return EntityMapper.map(order, OrderResponseDto);
  }

  markPaymentAsFailed(dto: UpdateOrderPaymentDto): Promise<OrderResponseDto> {
    return this.guard.lockAndTransaction(
      LOCK_KEY.ORDER.UPDATE(dto.orderId),
      async () => this._markPaymentAsFailed(dto),
    );
  }

  private async _markPaymentAsFailed(
    dto: UpdateOrderPaymentDto,
  ): Promise<OrderResponseDto> {
    const order = await this.getOrderOrThrow(dto.orderId);

    order.paymentId = dto.paymentId;
    order.paymentStatus = dto.paymentStatus;

    await this.orderRepository.save(order);

    // Enqueue the cancellation job (restores stock and updates status)
    await this.outboxService.add(new CancelOrderJobPayload(dto.orderId));

    return EntityMapper.map(order, OrderResponseDto);
  }

  //#endregion

  //#region Private helper methods

  private async getOrderOrThrow(id: string): Promise<Order> {
    const order = await this.orderRepository.findById(id, {
      relations: ['user', 'items'],
    });
    if (!order) {
      throw new NotFoundException(template(I18N_ORDERS.ERRORS.ORDER_NOT_FOUND));
    }
    return order;
  }

  private async createOrderWithItems(
    dto: CreateOrderDto,
    userId: string,
    catalogItems: Awaited<
      ReturnType<typeof this.itemsService.validateAndGetCatalogItems>
    >,
  ) {
    const total = dto.items.reduce((sum, dtoItem) => {
      const ci = catalogItems.find((ci) => ci.id === dtoItem.itemId)!;
      return sum + ci.price * dtoItem.quantity;
    }, 0);

    const order = this.orderRepository.createEntity({ userId, total });
    const savedOrder = await this.orderRepository.save(order);

    const orderItems = dto.items.map((dtoItem) =>
      this.orderItemRepository.createEntity({
        itemId: dtoItem.itemId,
        quantity: dtoItem.quantity,
        orderId: savedOrder.id,
      }),
    );
    await this.orderItemRepository.saveBulk(orderItems);
    return savedOrder;
  }

  private async decrementItemsStock(
    dto: CreateOrderDto,
    catalogItems: Awaited<
      ReturnType<typeof this.itemsService.validateAndGetCatalogItems>
    >,
  ) {
    await Promise.all(
      dto.items.map((dtoItem) => {
        const item = catalogItems.find((ci) => ci.id === dtoItem.itemId);
        return this.itemsService.decrementItemStock(item, dtoItem.quantity);
      }),
    );
  }

  private buildPaymentParams(
    order: {
      total: number;
      user?: { customerId?: string; email?: string };
      id: string;
    },
    userId: string,
  ): GatewayPaymentParams {
    return {
      amount: order.total,
      currency: 'brl',
      customerId: order.user?.customerId,
      receiptEmail: order.user?.email,
      metadata: { orderId: order.id, userId },
    };
  }

  private async dispatchOrderCreatedNotification(
    user: User,
    total: number,
  ): Promise<void> {
    const totalPrice = toCurrencyFormatted(
      total,
      languageToLocale(user.language),
      languageToCurrency(user.language),
    );
    const message = await this.messages.notifications.orderCreated(
      user.language,
      totalPrice,
    );
    await this.dispatchNotification(user, message);
  }

  private async dispatchNotification(user: User, message: string): Promise<void> {
    await this.outboxService.add(new NotifyUserJobPayload(user.id, message));
  }

  //#endregion
}
