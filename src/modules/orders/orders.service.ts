import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { OrderStatus } from './enums/order-status.enum';
import { CacheService } from '../cache/cache.service';
import { ProcessPaymentOrderJobPayload } from './processors/payloads/order-job.payload';
import { NotifyUserJobPayload } from '@/shared/modules/events/processors/payloads/notify-user.payload';
import { OrderRepository } from './repositories/order.repository';
import { OrderItemRepository } from './repositories/order-item.repository';
import { PaginatedResultDto } from '@/shared/dto/paginated-result.dto';
import { DataSource } from 'typeorm';
import { Transactional } from '@/shared/decorators/transactional.decorator';
import { OrderResponseDto } from './dto/order-response.dto';
import { CACHE_CONFIG } from '@/shared/constants/cache.constant';
import { OutboxService } from '@/shared/modules/outbox/outbox.service';
import { OutboxType } from '@/shared/modules/outbox/enums/outbox-type.enum';
import { runAndIgnoreError } from '@/shared/helpers/functions';
import { UseLock } from '@/shared/decorators/lock.decorator';
import Redlock from 'redlock';
import { CacheableService } from '@/shared/services/cacheable.service';

@Injectable()
export class OrdersService extends CacheableService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly orderItemRepository: OrderItemRepository,
    private readonly outboxService: OutboxService,
    protected readonly cacheService: CacheService,
    protected readonly dataSource: DataSource,
    protected readonly redlock: Redlock,
  ) {
    super(OrdersService.name, cacheService);
  }

  @Transactional()
  @UseLock({ prefix: 'order-create', key: ([, , idempotencyKey]) => idempotencyKey })
  async create(
    createOrderDto: CreateOrderDto,
    userId: string,
    idempotencyKey: string,
  ): Promise<OrderResponseDto> {
    const idempotencyKeyFormatted = `idempotency:order:create:${idempotencyKey}`;

    // Check if there's an existing order for the same idempotency key
    const existingOrder = await this.cacheService.get<OrderResponseDto>(
      idempotencyKeyFormatted,
    );
    if (existingOrder) {
      this.logger.debug('Returning existing order for idempotency key', {
        idempotencyKey,
        orderId: existingOrder.id,
      });
      return existingOrder;
    }

    this.logger.debug('Creating new order', { idempotencyKey });

    const total = createOrderDto.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    const order = this.orderRepository.createEntity({
      userId,
      total,
      status: OrderStatus.PENDING,
    });

    const savedOrder = await this.orderRepository.save(order);

    const orderItems = createOrderDto.items.map((item) =>
      this.orderItemRepository.createEntity({
        ...item,
        orderId: savedOrder.id,
      }),
    );

    await this.orderItemRepository.saveMany(orderItems);

    const completeOrder = await this.orderRepository.findOneWithRelations({
      id: savedOrder.id,
    });

    await this.invalidateCache({
      keysToDelete: [`cache:order:find-one:${completeOrder.id}`],
      patternsToDelete: ['cache:order:list:*'],
    });

    const orderMapped = OrderResponseDto.fromEntity(completeOrder);

    // Add to the Outbox for processing the order (job)
    await this.outboxService.add(
      OutboxType.ORDER_PROCESS,
      new ProcessPaymentOrderJobPayload(
        userId,
        completeOrder.id,
        total,
        completeOrder.user.name,
      ),
    );

    await this.cacheService.set(
      idempotencyKeyFormatted,
      orderMapped,
      CACHE_CONFIG.IDEMPOTENCY_TTL,
    );

    this.logger.debug('Order created', {
      idempotencyKey,
      orderId: completeOrder.id,
    });

    return orderMapped;
  }

  async findAll(
    queryDto: OrderQueryDto,
  ): Promise<PaginatedResultDto<OrderResponseDto>> {
    const cacheKey = `cache:order:find-all:${JSON.stringify(queryDto)}`;
    const cachedResult = await runAndIgnoreError(
      () => this.cacheService.get<PaginatedResultDto<OrderResponseDto>>(cacheKey),
      `fetching orders list from cache with key: ${cacheKey}`,
    );
    if (cachedResult) {
      this.logger.debug('Returning cached orders list', { cacheKey });
      return cachedResult;
    }

    const result = await this.orderRepository.findAllWithFilters(queryDto);

    await runAndIgnoreError(
      () => this.cacheService.set(cacheKey, result, CACHE_CONFIG.LIST_TTL),
      `caching orders list with key: ${cacheKey}`,
    );

    this.logger.debug(`Found ${result.data.length} orders`, {
      page: queryDto.page,
      totalPages: result.totalPages,
    });

    const resultMapped = new PaginatedResultDto<OrderResponseDto>(
      result.total,
      result.page,
      result.limit,
      result.data.map(OrderResponseDto.fromEntity),
    );

    return resultMapped;
  }

  async findOne(id: string): Promise<OrderResponseDto> {
    const cacheKey = `cache:order:find-one:${id}`;
    const cachedOrder = await runAndIgnoreError(
      () => this.cacheService.get<OrderResponseDto>(cacheKey),
      `fetching order from cache with key: ${cacheKey}`,
    );
    if (cachedOrder) {
      this.logger.debug('Returning cached order', { orderId: id });
      return cachedOrder;
    }

    const order = await this.orderRepository.findOneWithRelations({ id });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    const orderMapped = OrderResponseDto.fromEntity(order);

    await runAndIgnoreError(
      () => this.cacheService.set(cacheKey, orderMapped, CACHE_CONFIG.DEFAULT_TTL),
      `caching order with key: ${cacheKey}`,
    );

    this.logger.debug('Found order', { orderId: id });

    return orderMapped;
  }

  @Transactional()
  @UseLock({ prefix: 'order-update', key: ([id]) => id })
  async update(
    id: string,
    updateOrderDto: UpdateOrderDto,
  ): Promise<OrderResponseDto> {
    this.logger.debug('Updating order', { orderId: id });

    const order = await this.orderRepository.findOneWithRelations({ id });
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    Object.assign(order, updateOrderDto);

    // If items are updated, remove old items and add new ones
    if (updateOrderDto.items) {
      await this.orderItemRepository.delete({ orderId: id });

      const orderItems = updateOrderDto.items.map((item) =>
        this.orderItemRepository.createEntity({
          ...item,
          orderId: id,
        }),
      );

      await this.orderItemRepository.saveMany(orderItems);
      order.items = orderItems;

      order.total = updateOrderDto.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );
    }

    await this.orderRepository.save(order);

    await this.invalidateCache({
      keysToDelete: [`cache:order:find-one:${id}`],
      patternsToDelete: ['cache:order:find-all:*'],
    });

    this.logger.debug('Order updated', { orderId: id });

    return OrderResponseDto.fromEntity(order);
  }

  @Transactional()
  @UseLock({ prefix: 'order-remove', key: ([id]) => id })
  async remove(id: string): Promise<void> {
    this.logger.debug('Deleting order', { id });

    const order = await this.orderRepository.findById(id);
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    await this.orderRepository.delete(order.id);

    await this.invalidateCache({
      keysToDelete: [`cache:order:find-one:${id}`],
      patternsToDelete: ['cache:order:find-all:*'],
    });

    this.logger.debug('Order deleted successfully', { orderId: id });
  }

  @Transactional()
  @UseLock({ prefix: 'order-update', key: ([id]) => id })
  async updateStatus(id: string, status: OrderStatus): Promise<OrderResponseDto> {
    const order = await this.orderRepository.findOneWithRelations({ id });
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    const oldStatus = order.status;
    if (status === oldStatus) {
      this.logger.debug(`Order ${id} is already in status ${status}`);

      return OrderResponseDto.fromEntity(order);
    }

    order.status = status;
    await this.orderRepository.save(order);

    // Add to the Outbox to notify the user about the status change (Event Bus)
    await this.outboxService.add(
      OutboxType.EVENTS_NOTIFY_USER,
      new NotifyUserJobPayload(
        order.user.id,
        order.user.name,
        `<To user ${order.user.name}>: Your order with id ${order.id} status has been updated to ${status}`,
      ),
    );

    await this.invalidateCache({
      keysToDelete: [`cache:order:find-one:${id}`],
      patternsToDelete: ['cache:order:find-all:*'],
    });

    this.logger.debug('Order status updated', { orderId: id });

    return OrderResponseDto.fromEntity(order);
  }
}
