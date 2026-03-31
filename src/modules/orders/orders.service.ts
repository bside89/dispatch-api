import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { OrderStatus } from './enums/order-status.enum';
import { CacheService } from '../cache/cache.service';
import {
  CancelOrderJobPayload,
  ProcessOrderJobPayload,
} from './processors/payloads/order-job.payload';
import { NotifyUserJobData } from '../../shared/modules/events/payloads/notify-user.payload';
import { OrderRepository } from './repositories/order.repository';
import { OrderItemRepository } from './repositories/order-item.repository';
import { PaginatedResultDto } from '@/shared/dto/paginated-result.dto';
import { BaseService } from '@/shared/services/base.service';
import { DataSource } from 'typeorm';
import { Transactional } from '@/shared/decorators/transactional.decorator';
import { OrderResponseDto } from './dto/order-response.dto';
import { CACHE_CONFIG } from '@/shared/constants/cache.constant';
import { OutboxService } from '@/shared/modules/outbox/outbox.service';
import { OutboxType } from '@/shared/modules/outbox/enums/outbox-type.enum';

@Injectable()
export class OrdersService extends BaseService {
  private readonly CACHE_PREFIX = 'order';
  private readonly IDEMPOTENCY_PREFIX = 'order-idempotency';

  constructor(
    private readonly cacheService: CacheService,
    private readonly orderRepository: OrderRepository,
    private readonly orderItemRepository: OrderItemRepository,
    protected readonly dataSource: DataSource,
    protected readonly outboxService: OutboxService,
  ) {
    super(dataSource, OrdersService.name, outboxService);
  }

  @Transactional()
  async create(
    createOrderDto: CreateOrderDto,
    userId: string,
    idempotencyKey: string,
  ): Promise<OrderResponseDto> {
    const idempotencyKeyFormatted = `${this.IDEMPOTENCY_PREFIX}:${idempotencyKey}`;
    const existingOrder = await this.cacheService.get<OrderResponseDto>(
      idempotencyKeyFormatted,
    );
    if (existingOrder) {
      this.logger.debug(
        `Returning existing order for idempotency key: ${idempotencyKey}, Order ID: ${existingOrder.id}`,
      );
      return existingOrder;
    }

    this.logger.debug(
      `Creating new order with idempotency key: ${idempotencyKey}`,
    );

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

    const completeOrder = await this.orderRepository.findOneWithRelations(
      { id: savedOrder.id },
      ['items', 'user'],
    );

    await this.clearOrderCache(userId);

    const orderMapped = OrderResponseDto.fromEntity(completeOrder);

    await this.cacheService.set(
      idempotencyKeyFormatted,
      orderMapped,
      CACHE_CONFIG.IDEMPOTENCY_TTL,
    );

    // Add to the Outbox for processing the order (job)
    await this.outboxService.add(
      OutboxType.ORDER_PROCESS,
      new ProcessOrderJobPayload(
        userId,
        completeOrder.id,
        total,
        completeOrder.user.name,
      ),
    );

    this.logger.debug(
      `Order created and cached with idempotency key: ${idempotencyKey}, Order ID: ${completeOrder.id}`,
    );

    return orderMapped;
  }

  async findAll(
    queryDto: OrderQueryDto,
  ): Promise<PaginatedResultDto<OrderResponseDto>> {
    const cacheKey = `${this.CACHE_PREFIX}:list:${JSON.stringify(queryDto)}`;
    const cachedResult = await this.runAndIgnoreError(
      () =>
        this.cacheService.get<PaginatedResultDto<OrderResponseDto>>(cacheKey),
      `fetching orders list from cache with key: ${cacheKey}`,
    );
    if (cachedResult) {
      this.logger.debug(`Returning cached orders list`);
      return cachedResult;
    }

    const result = await this.orderRepository.findAllWithFilters(queryDto);

    await this.runAndIgnoreError(
      () => this.cacheService.set(cacheKey, result, CACHE_CONFIG.LIST_TTL),
      `caching orders list with key: ${cacheKey}`,
    );

    this.logger.debug(
      `Found ${result.data.length} orders (page ${queryDto.page}/${result.totalPages})`,
    );

    const resultMapped = new PaginatedResultDto<OrderResponseDto>(
      result.total,
      result.page,
      result.limit,
      result.data.map(OrderResponseDto.fromEntity),
    );

    return resultMapped;
  }

  async findOne(id: string): Promise<OrderResponseDto> {
    const cacheKey = `${this.CACHE_PREFIX}:${id}`;
    const cachedOrder = await this.runAndIgnoreError(
      () => this.cacheService.get<OrderResponseDto>(cacheKey),
      `fetching order from cache with key: ${cacheKey}`,
    );
    if (cachedOrder) {
      this.logger.debug(`Returning cached order: ${id}`);
      return cachedOrder;
    }

    const order = await this.orderRepository.findOneWithRelations({ id }, [
      'user',
      'items',
    ]);

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    const orderMapped = OrderResponseDto.fromEntity(order);

    await this.runAndIgnoreError(
      () =>
        this.cacheService.set(cacheKey, orderMapped, CACHE_CONFIG.DEFAULT_TTL),
      `caching order with key: ${cacheKey}`,
    );

    this.logger.debug(`Found order: ${id}`);

    return orderMapped;
  }

  @Transactional()
  async update(
    id: string,
    updateOrderDto: UpdateOrderDto,
  ): Promise<OrderResponseDto> {
    const order = await this.orderRepository.findOneWithRelations({ id }, [
      'user',
      'items',
    ]);
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

    await this.clearOrderCache(order.user.id, id);

    this.logger.debug(`Order updated: ${id}`);

    return OrderResponseDto.fromEntity(order);
  }

  @Transactional()
  async remove(id: string): Promise<OrderResponseDto> {
    const order = await this.findOne(id);

    const status = order.status;

    await this.orderRepository.delete(order.id);

    await this.clearOrderCache(order.user.id, id);

    if (status === OrderStatus.PENDING || status === OrderStatus.CONFIRMED) {
      // Add to the Outbox for cancellation (job)
      await this.outboxService.add(
        OutboxType.ORDER_CANCEL,
        new CancelOrderJobPayload(order.user.id, id, order.user.name),
      );
    }

    this.logger.debug(`Order deleted: ${id}`);

    return order;
  }

  @Transactional()
  async updateStatus(
    id: string,
    status: OrderStatus,
  ): Promise<OrderResponseDto> {
    const order = await this.orderRepository.findOneWithRelations({ id }, [
      'user',
      'items',
    ]);
    const oldStatus = order.status;
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    order.status = status;
    await this.orderRepository.save(order);

    if (status !== oldStatus) {
      // Add to the Outbot to notify the user about the status change (Event Bus)
      await this.outboxService.add(
        OutboxType.EVENTS_NOTIFY_USER,
        new NotifyUserJobData(
          order.user.id,
          order.user.name,
          `<To user ${order.user.name}>: Your order with id ${order.id} status has been updated to ${status}`,
        ),
      );
    }

    await this.clearOrderCache(order.user.id, id);

    this.logger.debug(`Order status updated: ${id}`);

    return OrderResponseDto.fromEntity(order);
  }

  private async clearOrderCache(
    userId?: string,
    orderId?: string,
  ): Promise<void> {
    const keysToDelete: string[] = [];
    const patternsToDelete: string[] = [];

    if (orderId) {
      keysToDelete.push(`${this.CACHE_PREFIX}:${orderId}`);
    }

    if (userId) {
      keysToDelete.push(`${this.CACHE_PREFIX}:user:${userId}`);
    }

    // Clear ALL list cache patterns using deletePattern
    // This clears ANY list cache regardless of pagination, filters, etc.
    patternsToDelete.push(`${this.CACHE_PREFIX}:list:*`);

    await Promise.all([
      // Delete specific keys
      ...keysToDelete.map((key) => this.cacheService.delete(key)),
      // Delete pattern-based keys
      ...patternsToDelete.map((pattern) =>
        this.cacheService.deletePattern(pattern),
      ),
    ]);

    this.logger.debug(
      `Cleared cache keys: ${keysToDelete.join(', ')} and patterns: ${patternsToDelete.join(', ')}`,
    );
  }
}
