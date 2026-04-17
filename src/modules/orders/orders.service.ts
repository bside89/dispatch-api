import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { OrderStatus } from './enums/order-status.enum';
import { CacheService } from '../../shared/modules/cache/cache.service';
import { NotifyUserJobPayload } from '@/shared/payloads/event-job.payload';
import { OrderRepository } from './repositories/order.repository';
import { OrderItemRepository } from './repositories/order-item.repository';
import { PaginatedResultDto } from '@/shared/dto/paginated-result.dto';
import { DataSource } from 'typeorm';
import { Transactional } from '@/shared/decorators/transactional.decorator';
import {
  OrderPaymentIntentDto,
  OrderResponseDto,
  PublicOrderResponseDto,
} from './dto/order-response.dto';
import { EntityMapper } from '@/shared/utils/entity-mapper';
import { CACHE_TTL } from '@/shared/constants/cache-ttl.constant';
import { OutboxService } from '@/shared/modules/outbox/outbox.service';
import { OutboxType } from '@/shared/modules/outbox/enums/outbox-type.enum';
import {
  ProcessOrderJobPayload,
  CancelOrderJobPayload,
  RefundOrderJobPayload,
} from '@/shared/payloads/order-job.payload';
import { ShipOrderDto } from './dto/ship-order.dto';
import { ORDER_STATUS_PRECONDITIONS } from './constants/order-status-preconditions.constant';
import { template } from '@/shared/helpers/functions';
import { UseLock } from '@/shared/decorators/lock.decorator';
import Redlock from 'redlock';
import { ORDER_KEY } from '../../shared/modules/cache/constants/order.key';
import type { RequestUser } from '../auth/interfaces/request-user.interface';
import { LOCK_PREFIX } from '@/shared/constants/lock-prefix.constant';
import { ItemsService } from '../items/items.service';
import { TransactionalService } from '@/shared/services/transactional.service';
import { PaymentsGatewayService } from '../payments-gateway/payments-gateway.service';
import { StripePaymentIntentCreateParams } from '../payments-gateway/types/payment-intent.types';
import { OrderMessageFactory } from './factories/order-message.factory';
import { I18N_ORDER } from '@/shared/constants/i18n';
import {
  languageToCurrency,
  languageToLocale,
  toCurrencyFormatted,
} from './helpers/functions';
import { OrderByUserQueryDto } from './dto/order-by-user-query.dto';

@Injectable()
export class OrdersService extends TransactionalService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly orderItemRepository: OrderItemRepository,
    private readonly itemsService: ItemsService,
    private readonly outboxService: OutboxService,
    private readonly paymentsGatewayService: PaymentsGatewayService,
    private readonly cacheService: CacheService,
    private readonly messages: OrderMessageFactory,
    dataSource: DataSource,
    redlock: Redlock,
  ) {
    super(OrdersService.name, dataSource, redlock);
  }

  //#region Public endpoints

  @Transactional()
  @UseLock({
    prefix: LOCK_PREFIX.ORDER.CREATE,
    key: ([, , idempotencyKey]) => idempotencyKey,
  })
  async publicCreate(
    dto: CreateOrderDto,
    userId: string,
    idempotencyKey: string,
  ): Promise<PublicOrderResponseDto> {
    /** 1. VALIDATION AND IDEMPOTENCY CHECK */

    const idempotencyKeyFormatted = ORDER_KEY.IDEMPOTENCY('create', idempotencyKey);
    const existingOrder = await this.cacheService.get<OrderResponseDto>(
      idempotencyKeyFormatted,
    );
    if (existingOrder) {
      this.logger.debug('Returning existing order for idempotency key', {
        idempotencyKey: idempotencyKeyFormatted,
        orderId: existingOrder.id,
      });
      return existingOrder;
    }

    const itemIds = dto.items.map((i) => i.itemId);
    const catalogItems = await this.itemsService.findManyByIds(itemIds);
    for (const dtoItem of dto.items) {
      if (!catalogItems.find((ci) => ci.id === dtoItem.itemId)) {
        throw new NotFoundException(template(I18N_ORDER.ERRORS.ORDER_NOT_FOUND));
      }
    }

    /** 2. INSERT ITEMS AND CREATE ORDER */

    const total = dto.items.reduce((sum, dtoItem) => {
      const ci = catalogItems.find((ci) => ci.id === dtoItem.itemId)!;
      return sum + ci.price * dtoItem.quantity;
    }, 0);

    const order = this.orderRepository.createEntity({
      userId,
      total,
      status: OrderStatus.PENDING,
    });
    const savedOrder = await this.orderRepository.save(order);

    const orderItems = dto.items.map((dtoItem) =>
      this.orderItemRepository.createEntity({
        itemId: dtoItem.itemId,
        quantity: dtoItem.quantity,
        orderId: savedOrder.id,
      }),
    );
    await this.orderItemRepository.saveBulk(orderItems);

    /** 3. CREATE PAYMENT-INTENT AND REDUCE ITEMS STOCK */

    await Promise.all(
      dto.items.map((dtoItem) => {
        const item = catalogItems.find((ci) => ci.id === dtoItem.itemId);
        if (item.stock < dtoItem.quantity) {
          throw new ForbiddenException(
            template(I18N_ORDER.ERRORS.INSUFFICIENT_STOCK),
          );
        }
        return this.itemsService.decrementItemStock(item, dtoItem.quantity);
      }),
    );

    const completeOrder = await this.orderRepository.findOne({
      where: { id: savedOrder.id },
      relations: ['user', 'items'],
    });

    const paymentIntentParams: StripePaymentIntentCreateParams = {
      amount: completeOrder.total,
      currency: 'brl',
      customer: completeOrder.user?.customerId,
      receipt_email: completeOrder.user?.email,
      confirmation_method: 'automatic',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        orderId: completeOrder.id,
        userId,
      },
    };

    const paymentIntent = await this.paymentsGatewayService.paymentIntentsCreate(
      paymentIntentParams,
      idempotencyKeyFormatted,
    );

    completeOrder.paymentIntentId = paymentIntent.id;
    completeOrder.paymentIntentStatus = paymentIntent.status;
    await this.orderRepository.save(completeOrder);

    /** 4. SIDE EFFECTS */

    const user = completeOrder.user;
    const totalPrice = toCurrencyFormatted(
      completeOrder.total,
      languageToLocale(user.language),
      languageToCurrency(user.language),
    );
    const message = await this.messages.notifications.orderCreated(
      user.language,
      totalPrice,
    );
    await this.outboxService.add(
      OutboxType.EVENTS_NOTIFY_USER,
      new NotifyUserJobPayload(user.id, message),
    );

    const orderMapped = EntityMapper.map(completeOrder, PublicOrderResponseDto);
    orderMapped.paymentIntent = EntityMapper.map(
      paymentIntent,
      OrderPaymentIntentDto,
    );

    await this.cacheService.set(
      idempotencyKeyFormatted,
      orderMapped,
      CACHE_TTL.IDEMPOTENCY,
    );

    this.logger.debug('Order created', {
      idempotencyKey: idempotencyKeyFormatted,
      orderId: completeOrder.id,
    });

    return orderMapped;
  }

  async publicFindByUser(
    queryDto: OrderByUserQueryDto,
    userId: string,
  ): Promise<PaginatedResultDto<PublicOrderResponseDto>> {
    const result = await this.orderRepository.filter({ ...queryDto, userId });

    this.logger.debug(`Found ${result.data.length} orders for user ${userId}`, {
      page: queryDto.page,
      totalPages: result.totalPages,
    });

    return new PaginatedResultDto<PublicOrderResponseDto>(
      result.total,
      result.page,
      result.limit,
      EntityMapper.mapArray(result.data, PublicOrderResponseDto),
    );
  }

  async publicFindOne(
    id: string,
    requestUser: RequestUser,
  ): Promise<PublicOrderResponseDto> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['user', 'items'],
    });
    if (!order || order.deactivated) {
      throw new NotFoundException(template(I18N_ORDER.ERRORS.ORDER_NOT_FOUND));
    }
    if (order.userId !== requestUser.id) {
      throw new ForbiddenException(template(I18N_ORDER.ERRORS.ACCESS_DENIED));
    }

    const paymentIntent = await this.paymentsGatewayService.paymentIntentsRetrieve(
      order.paymentIntentId,
    );

    const orderMapped = EntityMapper.map(order, PublicOrderResponseDto);
    orderMapped.paymentIntent = EntityMapper.map(
      paymentIntent,
      OrderPaymentIntentDto,
    );

    this.logger.debug('Found order', { orderId: id });

    return orderMapped;
  }

  //#endregion

  //#region Admin endpoints

  async adminFindAll(
    queryDto: OrderQueryDto,
  ): Promise<PaginatedResultDto<OrderResponseDto>> {
    const result = await this.orderRepository.filter(queryDto);

    this.logger.debug(`Found ${result.data.length} orders`, {
      page: queryDto.page,
      totalPages: result.totalPages,
    });

    return new PaginatedResultDto<OrderResponseDto>(
      result.total,
      result.page,
      result.limit,
      EntityMapper.mapArray(result.data, OrderResponseDto),
    );
  }

  async adminFindOne(id: string): Promise<OrderResponseDto> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['user', 'items'],
    });
    if (!order || order.deactivated) {
      throw new NotFoundException(template(I18N_ORDER.ERRORS.ORDER_NOT_FOUND));
    }

    const paymentIntent = await this.paymentsGatewayService.paymentIntentsRetrieve(
      order.paymentIntentId,
    );

    const orderMapped = EntityMapper.map(order, OrderResponseDto);
    orderMapped.paymentIntent = EntityMapper.map(
      paymentIntent,
      OrderPaymentIntentDto,
    );

    this.logger.debug('Found order', { orderId: id });

    return orderMapped;
  }

  @Transactional()
  @UseLock({ prefix: LOCK_PREFIX.ORDER.UPDATE, key: ([id]) => id })
  async adminUpdate(id: string, dto: UpdateOrderDto): Promise<OrderResponseDto> {
    this.logger.debug('Updating order', { orderId: id });

    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['items', 'user'],
    });
    if (!order || order.deactivated) {
      throw new NotFoundException(template(I18N_ORDER.ERRORS.ORDER_NOT_FOUND));
    }

    Object.assign(order, dto);
    await this.orderRepository.save(order);

    // Notify the user
    const user = order.user;
    const message = await this.messages.notifications.orderUpdated(
      user.language,
      order.status,
    );
    await this.outboxService.add(
      OutboxType.EVENTS_NOTIFY_USER,
      new NotifyUserJobPayload(user.id, message),
    );

    this.logger.debug('Order updated', { orderId: id });

    return EntityMapper.map(order, OrderResponseDto);
  }

  @Transactional()
  @UseLock({ prefix: LOCK_PREFIX.ORDER.REMOVE, key: ([id]) => id })
  async adminRemove(id: string): Promise<void> {
    this.logger.debug('Deleting order', { orderId: id });

    const order = await this.orderRepository.findById(id);
    if (!order || order.deactivated) {
      throw new NotFoundException(template(I18N_ORDER.ERRORS.ORDER_NOT_FOUND));
    }

    await this.orderRepository.update(id, {
      deactivated: true,
      deactivatedAt: new Date(),
    });

    this.logger.debug('Order deactivated', { orderId: id });
  }

  //#endregion

  //#region Internal / webhook methods

  @Transactional()
  @UseLock({ prefix: LOCK_PREFIX.ORDER.UPDATE, key: ([orderId]) => orderId })
  async markPaymentAsSucceeded(
    orderId: string,
    paymentIntentId: string,
    paymentIntentStatus: string,
  ): Promise<OrderResponseDto> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['user', 'items'],
    });
    if (!order) {
      throw new NotFoundException(template(I18N_ORDER.ERRORS.ORDER_NOT_FOUND));
    }

    order.paymentIntentId = paymentIntentId;
    order.paymentIntentStatus = paymentIntentStatus;
    order.status = OrderStatus.PAID;

    await this.orderRepository.save(order);

    // Kick off the order processing pipeline
    await this.outboxService.add(
      OutboxType.ORDER_PROCESS,
      new ProcessOrderJobPayload(orderId),
    );

    return EntityMapper.map(order, OrderResponseDto);
  }

  @Transactional()
  @UseLock({ prefix: LOCK_PREFIX.ORDER.UPDATE, key: ([orderId]) => orderId })
  async markPaymentAsFailed(
    orderId: string,
    paymentIntentId: string,
    paymentIntentStatus: string,
  ): Promise<OrderResponseDto> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['user', 'items'],
    });
    if (!order) {
      throw new NotFoundException(template(I18N_ORDER.ERRORS.ORDER_NOT_FOUND));
    }

    order.paymentIntentId = paymentIntentId;
    order.paymentIntentStatus = paymentIntentStatus;

    await this.orderRepository.save(order);

    // Enqueue the cancellation job (restores stock and updates status)
    await this.outboxService.add(
      OutboxType.ORDER_CANCEL,
      new CancelOrderJobPayload(orderId),
    );

    return EntityMapper.map(order, OrderResponseDto);
  }

  //#endregion

  //#region Operational admin methods

  @Transactional()
  @UseLock({ prefix: LOCK_PREFIX.ORDER.UPDATE, key: ([id]) => id })
  async ship(id: string, dto: ShipOrderDto): Promise<OrderResponseDto> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['user', 'items'],
    });

    /** 1. VALIDATION */

    if (!order || order.deactivated) {
      throw new NotFoundException(template(I18N_ORDER.ERRORS.ORDER_NOT_FOUND));
    }

    const preconditions = ORDER_STATUS_PRECONDITIONS[OrderStatus.SHIPPED];
    if (!preconditions.includes(order.status)) {
      throw new BadRequestException(
        template(I18N_ORDER.ERRORS.BAD_PRECONDITIONS, {
          status: OrderStatus.SHIPPED,
          currentStatus: order.status,
        }),
      );
    }

    /** UPDATE ORDER STATUS -> SHIPPED */

    order.status = OrderStatus.SHIPPED;
    order.shippedAt = new Date();
    if (dto.trackingNumber !== undefined) order.trackingNumber = dto.trackingNumber;
    if (dto.carrier !== undefined) order.carrier = dto.carrier;

    await this.orderRepository.save(order);

    /** 3. SIDE EFFECTS */

    const user = order.user;
    const message = await this.messages.notifications.orderShipped(user.language);
    await this.outboxService.add(
      OutboxType.EVENTS_NOTIFY_USER,
      new NotifyUserJobPayload(user.id, message),
    );

    this.logger.debug('Order shipped', { orderId: id });

    return EntityMapper.map(order, OrderResponseDto);
  }

  @Transactional()
  @UseLock({ prefix: LOCK_PREFIX.ORDER.UPDATE, key: ([id]) => id })
  async deliver(id: string): Promise<OrderResponseDto> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['user', 'items'],
    });

    /** 1. VALIDATION */

    if (!order || order.deactivated) {
      throw new NotFoundException(template(I18N_ORDER.ERRORS.ORDER_NOT_FOUND));
    }

    const preconditions = ORDER_STATUS_PRECONDITIONS[OrderStatus.DELIVERED];
    if (!preconditions.includes(order.status)) {
      throw new BadRequestException(
        template(I18N_ORDER.ERRORS.BAD_PRECONDITIONS, {
          status: OrderStatus.DELIVERED,
          currentStatus: order.status,
        }),
      );
    }

    /** 2. UPDATE ORDER STATUS -> DELIVERED */

    order.status = OrderStatus.DELIVERED;
    order.deliveredAt = new Date();

    await this.orderRepository.save(order);

    /** 3. SIDE EFFECTS */

    const user = order.user;
    const message = await this.messages.notifications.orderDelivered(user.language);
    await this.outboxService.add(
      OutboxType.EVENTS_NOTIFY_USER,
      new NotifyUserJobPayload(user.id, message),
    );

    this.logger.debug('Order delivered', { orderId: id });
    return EntityMapper.map(order, OrderResponseDto);
  }

  @Transactional()
  @UseLock({ prefix: LOCK_PREFIX.ORDER.UPDATE, key: ([id]) => id })
  async cancel(id: string): Promise<void> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    /** 1. VALIDATION */

    if (!order || order.deactivated) {
      throw new NotFoundException(template(I18N_ORDER.ERRORS.ORDER_NOT_FOUND));
    }

    const preconditions = ORDER_STATUS_PRECONDITIONS[OrderStatus.CANCELED];
    if (!preconditions.includes(order.status)) {
      throw new BadRequestException(
        template(I18N_ORDER.ERRORS.BAD_PRECONDITIONS, {
          status: OrderStatus.CANCELED,
          currentStatus: order.status,
        }),
      );
    }

    /** 2. DELEGATE TO JOB STRATEGY */

    await this.outboxService.add(
      OutboxType.ORDER_CANCEL,
      new CancelOrderJobPayload(id),
    );

    this.logger.debug('Order cancel enqueued', { orderId: id });
  }

  @Transactional()
  @UseLock({ prefix: LOCK_PREFIX.ORDER.UPDATE, key: ([id]) => id })
  async refund(id: string): Promise<void> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    /** 1. VALIDATION */

    if (!order || order.deactivated) {
      throw new NotFoundException(template(I18N_ORDER.ERRORS.ORDER_NOT_FOUND));
    }

    const preconditions = ORDER_STATUS_PRECONDITIONS[OrderStatus.REFUNDED];
    if (!preconditions.includes(order.status)) {
      throw new BadRequestException(
        template(I18N_ORDER.ERRORS.BAD_PRECONDITIONS, {
          status: OrderStatus.REFUNDED,
          currentStatus: order.status,
        }),
      );
    }

    /** 2. DELEGATE TO JOB STRATEGY */

    await this.outboxService.add(
      OutboxType.ORDER_REFUND,
      new RefundOrderJobPayload(id),
    );

    this.logger.debug('Order refund enqueued', { orderId: id });
  }

  //#endregion
}
