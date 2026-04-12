import { OrderRepository } from '../repositories/order.repository';
import { CacheService } from '@/shared/modules/cache/cache.service';
import { OrderStatus } from '../enums/order-status.enum';
import { DataSource } from 'typeorm';
import { UseLock } from '@/shared/decorators/lock.decorator';
import Redlock from 'redlock';
import { BaseJobPayload } from '@/shared/payloads/base-job.payload';
import { ORDER_KEY } from '../../../shared/modules/cache/constants/order.key';
import { BaseJobStrategy } from '@/shared/strategies/base-job.strategy';
import { Order } from '../entities/order.entity';
import { LOCK_PREFIX } from '@/shared/constants/lock-prefix.constants';

export abstract class BaseOrderJobStrategy<
  T extends BaseJobPayload,
> extends BaseJobStrategy<T> {
  protected readonly VALID_PRECONDITIONS = {
    [OrderStatus.PENDING]: [],
    [OrderStatus.PAID]: [OrderStatus.PENDING],
    [OrderStatus.SHIPPED]: [OrderStatus.PAID],
    [OrderStatus.DELIVERED]: [OrderStatus.SHIPPED],
    [OrderStatus.CANCELLED]: [OrderStatus.PENDING],
    [OrderStatus.REFUNDED]: [
      OrderStatus.PAID,
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
    ],
  };

  constructor(
    jobName: string,
    protected readonly cacheService: CacheService,
    protected readonly orderRepository: OrderRepository,
    protected readonly dataSource: DataSource, // Used in @Transactional()
    protected readonly redlock: Redlock, // Used in @UseLock()
  ) {
    super(jobName);
  }

  /**
   * Updates the order with the provided data (with lock).
   * @param orderId The ID of the order to update.
   * @param updateData The data to update the order with.
   */
  @UseLock({ prefix: LOCK_PREFIX.ORDER.UPDATE, key: ([orderId]) => orderId })
  async updateOrderWithLock(
    orderId: string,
    updateData: Partial<Order>,
  ): Promise<void> {
    await this.orderRepository.update(orderId, updateData);

    await this.cacheService.deleteBulk({
      keys: [ORDER_KEY.CACHE_FIND_ONE(orderId)],
      patterns: [ORDER_KEY.CACHE_FIND_ALL_PATTERN()],
    });
  }

  protected async getAndValidate(
    orderId: string,
    newStatus: OrderStatus,
  ): Promise<Order | null> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      this.logger.error(`Order ${orderId} does not exist`);
      return null;
    }
    const preconditions = this.VALID_PRECONDITIONS[newStatus];
    if (!preconditions.includes(order.status)) {
      this.logger.error(
        `Order ${orderId} must be ${preconditions.join(' or ')} ` +
          `to proceed; current status: ${order!.status}`,
      );
      return null;
    }
    return order;
  }
}
