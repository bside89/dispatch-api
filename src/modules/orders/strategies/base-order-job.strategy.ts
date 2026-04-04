import { OrderRepository } from '../repositories/order.repository';
import { CacheService } from '@/modules/cache/cache.service';
import { OrderStatus } from '../enums/order-status.enum';
import { DataSource } from 'typeorm';
import { UseLock } from '@/shared/decorators/lock.decorator';
import Redlock from 'redlock';
import { IdempotentJobStrategy } from '@/shared/strategies/idempotent-job.strategy';
import { BaseJobPayload } from '@/shared/jobs/base-job.payload';

export abstract class BaseOrderJobStrategy<
  T extends BaseJobPayload,
> extends IdempotentJobStrategy<T> {
  constructor(
    protected readonly jobName: string,
    protected readonly cacheService: CacheService,
    protected readonly orderRepository: OrderRepository,
    protected readonly dataSource: DataSource,
    protected readonly redlock: Redlock,
  ) {
    super(jobName, cacheService);
  }

  @UseLock({ prefix: 'order-update', key: ([orderId]) => orderId })
  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
    await this.orderRepository.update(orderId, { status });
  }
}
