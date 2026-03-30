import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { OrderStatus } from '../enums/order-status.enum';
import { CacheService } from '../../cache/cache.service';
import { DataSource } from 'typeorm';
import { CACHE_CONFIG } from '@/shared/constants/cache.constant';
import { OrderRepository } from '../repositories/order.repository';
import { OutboxService } from '@/shared/modules/outbox/outbox.service';

export abstract class BaseOrderJobStrategy<T = any> {
  constructor(
    protected readonly cacheService: CacheService,
    protected readonly outboxService: OutboxService,
    protected readonly orderRepository: OrderRepository,
    protected readonly dataSource: DataSource,
  ) {}

  protected async isAlreadyInStatus(
    orderId: string,
    status: OrderStatus,
  ): Promise<boolean> {
    const order = await this.orderRepository.findOneWhere({ id: orderId });
    return order?.status === status;
  }

  protected async isAlreadyInStatusArray(
    orderId: string,
    statuses: OrderStatus[],
  ): Promise<boolean> {
    const order = await this.orderRepository.findOneWhere({ id: orderId });
    return order ? statuses.includes(order.status as OrderStatus) : false;
  }

  protected async hasKey(key: string): Promise<boolean> {
    return !!(await this.cacheService.get(key));
  }

  protected async setKey(
    key: string,
    ttl = CACHE_CONFIG.JOB_STRATEGY_TTL,
  ): Promise<void> {
    await this.cacheService.set(key, '1', ttl);
  }

  protected async removeKey(key: string): Promise<void> {
    await this.cacheService.delete(key);
  }

  abstract execute(job: Job<T>, logger: Logger): Promise<void>;
}
