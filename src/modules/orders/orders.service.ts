import { Injectable, NotFoundException, Logger, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Order } from './entities/order.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { OrderStatus } from './enums/order-status.enum';
import { OrderJob } from './enums/order-job.enum';
import { CacheService } from '../cache/cache.service';
import { CancelOrderJobData, ProcessOrderJobData } from './misc/order-job-data';
import { EVENT_BUS } from '../events/constants/event-bus.token';
import { EventBus } from '../events/interfaces/event-bus.interface';
import { NotifyUserJobData } from '../events/misc/events-job-data';
import { OrderRepository } from './repositories/order.repository';
import { OrderItemRepository } from './repositories/order-item.repository';
import { User } from '../users/entities/user.entity';
import { PaginatedResultDto } from '@/shared/dto/paginated-result.dto';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly CACHE_PREFIX = 'order';
  private readonly IDEMPOTENCY_PREFIX = 'idempotency';
  private readonly CACHE_TTL = 300 * 1000; // 5 minutes - for individual orders
  private readonly LIST_CACHE_TTL = 60 * 1000; // 1 minute - for order lists (shorter TTL)
  private readonly IDEMPOTENCY_TTL = 86400 * 1000; // 24 hours

  constructor(
    @InjectQueue('orders')
    private readonly orderQueue: Queue,
    @Inject(EVENT_BUS)
    private readonly eventBus: EventBus,

    private readonly cacheService: CacheService,
    private readonly orderRepository: OrderRepository,
    private readonly orderItemRepository: OrderItemRepository,
  ) {}

  async create(
    createOrderDto: CreateOrderDto,
    userId: string,
    idempotencyKey: string,
  ): Promise<Order> {
    const idempotencyKeyFormatted = `${this.IDEMPOTENCY_PREFIX}:${idempotencyKey}`;

    // Check if this idempotency key already exists
    const existingOrder = await this.cacheService.get<Order>(
      idempotencyKeyFormatted,
    );
    if (existingOrder) {
      this.logger.log(
        `Returning existing order for idempotency key: ${idempotencyKey}, Order ID: ${existingOrder.id}`,
      );
      return existingOrder;
    }

    this.logger.log(
      `Creating new order with idempotency key: ${idempotencyKey}`,
    );

    // Calculate total
    const total = createOrderDto.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    // Create order entity
    const order = this.orderRepository.createEntity({
      user: new User(),
      total,
      status: OrderStatus.PENDING,
    });
    order.user.id = userId;

    // Save order first to get the ID
    const savedOrder = await this.orderRepository.save(order);

    // Create order items
    const orderItems = createOrderDto.items.map((item) =>
      this.orderItemRepository.createEntity({
        ...item,
        orderId: savedOrder.id,
      }),
    );

    // Save order items
    await this.orderItemRepository.saveMany(orderItems);

    // Fetch complete order with items
    const completeOrder = await this.orderRepository.findOneWithRelations(
      { id: savedOrder.id },
      ['items'],
    );

    // Add job to processing queue
    await this.orderQueue.add(
      OrderJob.PROCESS_ORDER,
      new ProcessOrderJobData(userId, completeOrder.id, total),
    );

    // Clear related cache
    await this.clearOrderCache(userId);

    // Cache the created order with idempotency key
    await this.cacheService.set(
      idempotencyKeyFormatted,
      completeOrder,
      this.IDEMPOTENCY_TTL,
    );

    this.logger.log(
      `Order created and cached with idempotency key: ${idempotencyKey}, Order ID: ${completeOrder.id}`,
    );

    return completeOrder;
  }

  async findAll(queryDto: OrderQueryDto): Promise<PaginatedResultDto<Order>> {
    // Check cache first
    const cacheKey = `${this.CACHE_PREFIX}:list:${JSON.stringify(queryDto)}`;
    const cachedResult =
      await this.cacheService.get<PaginatedResultDto<Order>>(cacheKey);
    if (cachedResult) {
      this.logger.log(`Returning cached orders list`);
      return cachedResult;
    }

    const result = await this.orderRepository.findAllWithFilters(queryDto);

    // Cache the result with shorter TTL for lists
    await this.cacheService.set(cacheKey, result, this.LIST_CACHE_TTL);

    this.logger.log(
      `Found ${result.data.length} orders (page ${queryDto.page}/${result.totalPages})`,
    );

    return result;
  }

  async findOne(id: string): Promise<Order> {
    // Check cache first
    const cacheKey = `${this.CACHE_PREFIX}:${id}`;
    const cachedOrder = await this.cacheService.get<Order>(cacheKey);
    if (cachedOrder) {
      this.logger.log(`Returning cached order: ${id}`);
      return cachedOrder;
    }

    const order = await this.orderRepository.findOneWithRelations({ id }, [
      'user',
      'items',
    ]);

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    // Cache the order
    await this.cacheService.set(cacheKey, order, this.CACHE_TTL);

    this.logger.log(`Found order: ${id}`);
    return order;
  }

  async update(id: string, updateOrderDto: UpdateOrderDto): Promise<Order> {
    const order = await this.findOne(id);
    const oldStatus = order.status;

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    // Update order properties
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

      // Recalculate total
      order.total = updateOrderDto.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );
    }

    await this.orderRepository.save(order);

    // Notify status change if status is updated
    if (updateOrderDto.status && updateOrderDto.status !== oldStatus) {
      await this.eventBus.publish(
        new NotifyUserJobData(
          order.user.id,
          `TO CUSTOMER: Your order with id ${order.id} status has been updated to ${updateOrderDto.status}`,
        ),
      );
    }

    // Clear cache
    await this.clearOrderCache(order.user.id, id);

    this.logger.log(`Order updated: ${id}`);

    // Return complete order with items
    return this.findOne(id);
  }

  async remove(id: string): Promise<Order> {
    const order = await this.findOne(id);

    if (
      order.status === OrderStatus.PENDING ||
      order.status === OrderStatus.CONFIRMED
    ) {
      // Add cancellation job to queue
      await this.orderQueue.add(
        OrderJob.CANCEL_ORDER,
        new CancelOrderJobData(id, order.user.id),
      );
    }

    await this.orderRepository.delete(order.id);

    // Clear cache
    await this.clearOrderCache(order.user.id, id);

    this.logger.log(`Order deleted: ${id}`);

    return order;
  }

  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    const updateDto: UpdateOrderDto = { status };
    return this.update(id, updateDto);
  }

  private async clearOrderCache(
    userId?: string,
    orderId?: string,
  ): Promise<void> {
    const keysToDelete: string[] = [];
    const patternsToDelete: string[] = [];

    // Clear specific order if ID provided
    if (orderId) {
      keysToDelete.push(`${this.CACHE_PREFIX}:${orderId}`);
    }

    // Clear user orders if user ID provided
    if (userId) {
      keysToDelete.push(`${this.CACHE_PREFIX}:user:${userId}`);
    }

    // Clear ALL list cache patterns using deletePattern
    // This clears ANY list cache regardless of pagination, filters, etc.
    patternsToDelete.push(`${this.CACHE_PREFIX}:list:*`);

    // Execute deletions
    await Promise.all([
      // Delete specific keys
      ...keysToDelete.map((key) => this.cacheService.delete(key)),
      // Delete pattern-based keys
      ...patternsToDelete.map((pattern) =>
        this.cacheService.deletePattern(pattern),
      ),
    ]);

    this.logger.log(
      `Cleared cache keys: ${keysToDelete.join(', ')} and patterns: ${patternsToDelete.join(', ')}`,
    );
  }

  /**
   * Clear only user-specific cached data (for targeted invalidation)
   */
  private async clearUserOrderCache(userId: string): Promise<void> {
    const keysToDelete = [`${this.CACHE_PREFIX}:user:${userId}`];

    // Clear only list caches that might contain this user's orders
    const patternsToDelete = [
      `${this.CACHE_PREFIX}:list:*"userId":"${userId}"*`, // Lists filtered by this user
      `${this.CACHE_PREFIX}:list:*`, // or clear all lists (safer but less efficient)
    ];

    await Promise.all([
      ...keysToDelete.map((key) => this.cacheService.delete(key)),
      // Use only the first pattern if you want targeted clearing, or the second for safety
      this.cacheService.deletePattern(patternsToDelete[1]), // Using global clear for safety
    ]);

    this.logger.log(`Cleared user-specific cache for userId: ${userId}`);
  }
}
