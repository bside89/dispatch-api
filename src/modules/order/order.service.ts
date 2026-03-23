import { Injectable, NotFoundException, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { OrderStatus } from './enums/order-status.enum';
import { OrderJob } from './enums/order-job.enum';
import { JobQueue } from '../common/enums/job-queue.enum';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);
  private readonly CACHE_PREFIX = 'order';
  private readonly IDEMPOTENCY_PREFIX = 'idempotency';
  private readonly CACHE_TTL = 300 * 1000; // 5 minutes - for individual orders
  private readonly LIST_CACHE_TTL = 60 * 1000; // 1 minute - for order lists (shorter TTL)
  private readonly IDEMPOTENCY_TTL = 86400 * 1000; // 24 hours

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectQueue(JobQueue.ORDER_PROCESSING)
    private readonly orderQueue: Queue,

    private readonly cacheService: CacheService,
  ) {}

  async create(
    createOrderDto: CreateOrderDto,
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
    const order = this.orderRepository.create({
      userId: createOrderDto.userId,
      total,
      status: OrderStatus.PENDING,
    });

    // Save order first to get the ID
    const savedOrder = await this.orderRepository.save(order);

    // Create order items
    const orderItems = createOrderDto.items.map((item) =>
      this.orderItemRepository.create({
        ...item,
        orderId: savedOrder.id,
      }),
    );

    // Save order items
    await this.orderItemRepository.save(orderItems);

    // Fetch complete order with items
    const completeOrder = await this.orderRepository.findOne({
      where: { id: savedOrder.id },
      relations: ['items'],
    });

    // Add job to processing queue
    await this.orderQueue.add(OrderJob.ProcessOrder, {
      orderId: completeOrder.id,
      userId: completeOrder.userId,
      total: completeOrder.total,
    });

    // Clear related cache
    await this.clearOrderCache(completeOrder.userId);

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

  async findAll(queryDto: OrderQueryDto): Promise<OrderResponseDto> {
    const {
      userId,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = queryDto;

    const cacheKey = `${this.CACHE_PREFIX}:list:${JSON.stringify(queryDto)}`;
    const cachedResult =
      await this.cacheService.get<OrderResponseDto>(cacheKey);

    if (cachedResult) {
      this.logger.log(`Returning cached orders list`);
      return cachedResult;
    }

    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .orderBy('order.createdAt', 'DESC');

    // Apply filters
    if (userId) {
      queryBuilder.andWhere('order.userId = :userId', { userId });
    }

    if (status) {
      queryBuilder.andWhere('order.status = :status', { status });
    }

    if (startDate && endDate) {
      queryBuilder.andWhere('order.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    // Get total count
    const total = await queryBuilder.getCount();

    // Apply pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const orders = await queryBuilder.getMany();

    const result: OrderResponseDto = {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: orders,
    };

    // Cache the result with shorter TTL for lists
    await this.cacheService.set(cacheKey, result, this.LIST_CACHE_TTL);

    this.logger.log(
      `Found ${orders.length} orders (page ${page}/${result.totalPages})`,
    );
    return result;
  }

  async findOne(id: string): Promise<Order> {
    const cacheKey = `${this.CACHE_PREFIX}:${id}`;
    const cachedOrder = await this.cacheService.get<Order>(cacheKey);

    if (cachedOrder) {
      this.logger.log(`Returning cached order: ${id}`);
      return cachedOrder;
    }

    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['items'],
    });

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

    // Update order properties
    Object.assign(order, updateOrderDto);

    // If items are updated, remove old items and add new ones
    if (updateOrderDto.items) {
      await this.orderItemRepository.delete({ orderId: id });

      const orderItems = updateOrderDto.items.map((item) =>
        this.orderItemRepository.create({
          ...item,
          orderId: id,
        }),
      );

      await this.orderItemRepository.save(orderItems);

      // Recalculate total
      order.total = updateOrderDto.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );
    }

    const updatedOrder = await this.orderRepository.save(order);

    // Add status update job to queue if status changed
    if (updateOrderDto.status && updateOrderDto.status !== order.status) {
      await this.orderQueue.add(OrderJob.UpdateStatus, {
        orderId: id,
        oldStatus: order.status,
        newStatus: updateOrderDto.status,
      });
    }

    // Clear cache
    await this.clearOrderCache(order.userId, id);

    this.logger.log(`Order updated: ${id}`);

    // Return complete order with items
    return this.findOne(id);
  }

  async remove(id: string): Promise<Order> {
    const order = await this.findOne(id);

    // Add cancellation job to queue
    await this.orderQueue.add(OrderJob.CancelOrder, {
      orderId: id,
      userId: order.userId,
    });

    await this.orderRepository.remove(order);

    // Clear cache
    await this.clearOrderCache(order.userId, id);

    this.logger.log(`Order deleted: ${id}`);
    return order;
  }

  async findByUserId(userId: string): Promise<Order[]> {
    const cacheKey = `${this.CACHE_PREFIX}:user:${userId}`;
    const cachedOrders = await this.cacheService.get<Order[]>(cacheKey);

    if (cachedOrders) {
      this.logger.log(`Returning cached orders for user: ${userId}`);
      return cachedOrders;
    }

    const orders = await this.orderRepository.find({
      where: { userId },
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });

    // Cache the orders with shorter TTL (it's a list)
    await this.cacheService.set(cacheKey, orders, this.LIST_CACHE_TTL);

    this.logger.log(`Found ${orders.length} orders for user: ${userId}`);
    return orders;
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
