import { OrderRepository } from '../repositories/order.repository';
import { CacheService } from '@/shared/modules/cache/cache.service';
import { OrderStatus } from '../enums/order-status.enum';
import { DataSource } from 'typeorm';
import { UseLock } from '@/shared/decorators/lock.decorator';
import Redlock from 'redlock';
import { BaseJobPayload } from '@/shared/jobs/base-job.payload';
import { ORDER_KEY } from '../constants/order.key';
import { BaseJobStrategy } from '@/shared/strategies/base-job.strategy';

export abstract class BaseOrderJobStrategy<
  T extends BaseJobPayload,
> extends BaseJobStrategy<T> {
  constructor(
    protected readonly jobName: string,
    protected readonly cacheService: CacheService,
    protected readonly orderRepository: OrderRepository,
    protected readonly dataSource: DataSource, // Used in @Transactional()
    protected readonly redlock: Redlock, // Used in @UseLock()
  ) {
    super(jobName);
  }

  @UseLock({ prefix: 'order-update', key: ([orderId]) => orderId })
  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
    await this.orderRepository.update(orderId, { status });

    await this.cacheService.deleteBulk({
      keysToDelete: [ORDER_KEY.CACHE_FIND_ONE(orderId)],
      patternsToDelete: [ORDER_KEY.CACHE_FIND_ALL_PATTERN()],
    });
  }
}
