import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { OrderStatus } from './enums/order-status.enum';
import { CacheService } from '../../shared/modules/cache/cache.service';
import { ProcessOrderJobPayload } from '../../shared/payloads/order-job.payload';
import { NotifyUserJobPayload } from '@/shared/payloads/event-job.payload';
import { OrderRepository } from './repositories/order.repository';
import { OrderItemRepository } from './repositories/order-item.repository';
import { PaginatedResultDto } from '@/shared/dto/paginated-result.dto';
import { DataSource } from 'typeorm';
import { Transactional } from '@/shared/decorators/transactional.decorator';
import { OrderResponseDto } from './dto/order-response.dto';
import { EntityMapper } from '@/shared/utils/entity-mapper';
import { CACHE_TTL } from '@/shared/constants/cache-ttl.constant';
import { OutboxService } from '@/shared/modules/outbox/outbox.service';
import { OutboxType } from '@/shared/modules/outbox/enums/outbox-type.enum';
import { runAndIgnoreError } from '@/shared/helpers/functions';
import { UseLock } from '@/shared/decorators/lock.decorator';
import Redlock from 'redlock';
import { BaseService } from '@/shared/services/base.service';
import { ORDER_KEY } from '../../shared/modules/cache/constants/order.key';
import type { RequestUser } from '../auth/interfaces/request-user.interface';
import { UserRole } from '../users/enums/user-role.enum';

@Injectable()
export class OrdersService extends BaseService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly orderItemRepository: OrderItemRepository,
    private readonly outboxService: OutboxService,
    protected readonly cacheService: CacheService,
    protected readonly dataSource: DataSource, // Used in @Transactional()
    protected readonly redlock: Redlock, // Used in @UseLock()
  ) {
    super(OrdersService.name);
  }

  @Transactional()
  @UseLock({ prefix: 'order-create', key: ([, , idempotencyKey]) => idempotencyKey })
  async create(
    createOrderDto: CreateOrderDto,
    userId: string,
    idempotencyKey: string,
  ): Promise<OrderResponseDto> {
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

    this.logger.debug('Creating new order', {
      idempotencyKey: idempotencyKeyFormatted,
    });

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

    await this.orderItemRepository.saveBulk(orderItems);

    const completeOrder = await this.orderRepository.findOne({
      where: { id: savedOrder.id },
      relations: ['user', 'items'],
    });

    await this.cacheService.deleteBulk({
      keys: [ORDER_KEY.CACHE_FIND_ONE(completeOrder.id)],
      patterns: [ORDER_KEY.CACHE_FIND_ALL_PATTERN()],
    });

    const orderMapped = EntityMapper.map(completeOrder, OrderResponseDto);

    // Add to the outbox for processing the order (job)
    await this.outboxService.add(
      OutboxType.ORDER_PROCESS,
      new ProcessOrderJobPayload(userId, completeOrder.id, completeOrder.user.name),
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

  async findAll(
    queryDto: OrderQueryDto,
    requestUser?: RequestUser,
  ): Promise<PaginatedResultDto<OrderResponseDto>> {
    const effectiveQuery =
      requestUser?.jwtPayload?.role === UserRole.ADMIN
        ? queryDto
        : {
            ...queryDto,
            userId: requestUser?.id,
          };

    const cacheKey = ORDER_KEY.CACHE_FIND_ALL(effectiveQuery);
    const cachedResult = await runAndIgnoreError(
      () => this.cacheService.get<PaginatedResultDto<OrderResponseDto>>(cacheKey),
      `fetching orders list from cache with key: ${cacheKey}`,
      this.logger,
    );
    if (cachedResult) {
      this.logger.debug('Returning cached orders list', { cacheKey });
      return cachedResult;
    }

    const result = await this.orderRepository.filter(effectiveQuery);

    this.logger.debug(`Found ${result.data.length} orders`, {
      page: queryDto.page,
      totalPages: result.totalPages,
    });

    const resultMapped = new PaginatedResultDto<OrderResponseDto>(
      result.total,
      result.page,
      result.limit,
      EntityMapper.mapArray(result.data, OrderResponseDto),
    );

    await runAndIgnoreError(
      () => this.cacheService.set(cacheKey, resultMapped, CACHE_TTL.LIST),
      `caching orders list with key: ${cacheKey}`,
      this.logger,
    );

    return resultMapped;
  }

  async findOne(id: string, requestUser?: RequestUser): Promise<OrderResponseDto> {
    const cacheKey = ORDER_KEY.CACHE_FIND_ONE(id);
    const cachedOrder = await runAndIgnoreError(
      () => this.cacheService.get<OrderResponseDto>(cacheKey),
      `fetching order from cache with key: ${cacheKey}`,
      this.logger,
    );
    if (cachedOrder) {
      if (requestUser?.jwtPayload?.role !== UserRole.ADMIN) {
        if (cachedOrder.user?.id) {
          this.assertOrderAccess(cachedOrder.user.id, requestUser, id);
        } else {
          this.logger.debug(
            'Cached order does not include ownership data, reloading from database',
            {
              orderId: id,
            },
          );

          const order = await this.orderRepository.findOne({
            where: { id },
            relations: ['user', 'items'],
          });

          if (!order) {
            throw new NotFoundException(`Order with ID ${id} not found`);
          }

          this.assertOrderAccess(order.userId, requestUser, id);

          const orderMapped = EntityMapper.map(order, OrderResponseDto);

          await runAndIgnoreError(
            () => this.cacheService.set(cacheKey, orderMapped, CACHE_TTL.DEFAULT),
            `caching order with key: ${cacheKey}`,
            this.logger,
          );

          this.logger.debug('Found order', { orderId: id });

          return orderMapped;
        }
      }

      this.logger.debug('Returning cached order', { orderId: id });
      return cachedOrder;
    }

    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['user', 'items'],
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    this.assertOrderAccess(order.userId, requestUser, id);

    const orderMapped = EntityMapper.map(order, OrderResponseDto);

    await runAndIgnoreError(
      () => this.cacheService.set(cacheKey, orderMapped, CACHE_TTL.DEFAULT),
      `caching order with key: ${cacheKey}`,
      this.logger,
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

    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['items'],
    });
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

      await this.orderItemRepository.saveBulk(orderItems);
      order.items = orderItems;

      order.total = updateOrderDto.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );
    }

    await this.orderRepository.save(order);

    await this.cacheService.deleteBulk({
      keys: [ORDER_KEY.CACHE_FIND_ONE(id)],
      patterns: [ORDER_KEY.CACHE_FIND_ALL_PATTERN()],
    });

    this.logger.debug('Order updated', { orderId: id });

    return EntityMapper.map(order, OrderResponseDto);
  }

  @Transactional()
  @UseLock({ prefix: 'order-remove', key: ([id]) => id })
  async remove(id: string): Promise<void> {
    this.logger.debug('Deleting order', { orderId: id });

    const order = await this.orderRepository.findById(id);
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    await this.orderRepository.deleteById(order.id);

    await this.cacheService.deleteBulk({
      keys: [ORDER_KEY.CACHE_FIND_ONE(id)],
      patterns: [ORDER_KEY.CACHE_FIND_ALL_PATTERN()],
    });

    this.logger.debug('Order deleted', { orderId: id });
  }

  @Transactional()
  @UseLock({ prefix: 'order-update', key: ([id]) => id })
  async updateStatus(id: string, status: OrderStatus): Promise<OrderResponseDto> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    if (!order.user) {
      throw new NotFoundException(`User for order with ID ${id} not found`);
    }

    const oldStatus = order.status;
    if (status === oldStatus) {
      this.logger.debug(`Order ${id} is already in status ${status}`);

      return EntityMapper.map(order, OrderResponseDto);
    }

    order.status = status;
    await this.orderRepository.save(order);

    // Notify the user
    await this.outboxService.add(
      OutboxType.EVENTS_NOTIFY_USER,
      new NotifyUserJobPayload(
        order.user!.id,
        order.user!.name,
        `<To user ${order.user!.name}>: Your order with id ${order.id} status has been updated to ${status}`,
      ),
    );

    await this.cacheService.deleteBulk({
      keys: [ORDER_KEY.CACHE_FIND_ONE(id)],
      patterns: [ORDER_KEY.CACHE_FIND_ALL_PATTERN()],
    });

    this.logger.debug('Order status updated', { orderId: id });

    return EntityMapper.map(order, OrderResponseDto);
  }

  private assertOrderAccess(
    orderOwnerId: string | undefined,
    requestUser: RequestUser | undefined,
    orderId: string,
  ): void {
    if (requestUser?.jwtPayload?.role === UserRole.ADMIN) {
      return;
    }

    if (!requestUser || orderOwnerId !== requestUser.id) {
      throw new ForbiddenException(
        `You are not allowed to access order with ID ${orderId}`,
      );
    }
  }
}
