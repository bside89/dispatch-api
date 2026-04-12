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
import { ORDER_KEY } from '../../shared/modules/cache/constants/order.key';
import type { RequestUser } from '../auth/interfaces/request-user.interface';
import { UserRole } from '../users/enums/user-role.enum';
import { LOCK_PREFIX } from '@/shared/constants/lock-prefix.constants';
import { ItemsService } from '../items/items.service';
import { TransactionalService } from '@/shared/services/transactional.service';

@Injectable()
export class OrdersService extends TransactionalService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly orderItemRepository: OrderItemRepository,
    private readonly itemsService: ItemsService,
    private readonly outboxService: OutboxService,
    private readonly cacheService: CacheService,
    dataSource: DataSource,
    redlock: Redlock,
  ) {
    super(OrdersService.name, dataSource, redlock);
  }

  @Transactional()
  @UseLock({
    prefix: LOCK_PREFIX.ORDER.CREATE,
    key: ([, , idempotencyKey]) => idempotencyKey,
  })
  async create(
    dto: CreateOrderDto,
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

    const itemIds = dto.items.map((i) => i.itemId);
    const catalogItems = await this.itemsService.findManyByIds(itemIds);
    for (const dtoItem of dto.items) {
      if (!catalogItems.find((ci) => ci.id === dtoItem.itemId)) {
        throw new NotFoundException(`Item with ID ${dtoItem.itemId} not found`);
      }
    }

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

    // Reduce stock quantity of the items
    await Promise.all(
      dto.items.map((dtoItem) => {
        const item = catalogItems.find((ci) => ci.id === dtoItem.itemId);
        if (item.stock < dtoItem.quantity) {
          throw new ForbiddenException(
            `Insufficient stock for item ${item.name}. Available: ${item.stock}, requested: ${dtoItem.quantity}`,
          );
        }
        return this.itemsService.decrementItemStock(item, dtoItem.quantity);
      }),
    );

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
  @UseLock({ prefix: LOCK_PREFIX.ORDER.UPDATE, key: ([id]) => id })
  async update(id: string, dto: UpdateOrderDto): Promise<OrderResponseDto> {
    this.logger.debug('Updating order', { orderId: id });

    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['items', 'user'],
    });
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    Object.assign(order, dto);
    await this.orderRepository.save(order);

    await this.cacheService.deleteBulk({
      keys: [ORDER_KEY.CACHE_FIND_ONE(id)],
      patterns: [ORDER_KEY.CACHE_FIND_ALL_PATTERN()],
    });

    // Notify the user
    await this.outboxService.add(
      OutboxType.EVENTS_NOTIFY_USER,
      new NotifyUserJobPayload(
        order.user!.id,
        order.user!.name,
        `<To user ${order.user!.name}>: Your order with id ${order.id} status has been updated to ${dto.status}`,
      ),
    );

    this.logger.debug('Order updated', { orderId: id });

    return EntityMapper.map(order, OrderResponseDto);
  }

  @Transactional()
  @UseLock({ prefix: LOCK_PREFIX.ORDER.REMOVE, key: ([id]) => id })
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
