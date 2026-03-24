import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { OrderStatus } from '../enums/order-status.enum';
import { CacheService } from '../../cache/cache.service';
import { Order } from '../entities/order.entity';
import { Repository } from 'typeorm';

export interface JobProcessingStrategy<T = any> {
  execute(job: Job<T>, logger: Logger): Promise<void>;
}

export abstract class BaseJobStrategy<
  T = any,
> implements JobProcessingStrategy<T> {
  constructor(
    protected readonly orderRepository: Repository<Order>,
    protected readonly cacheService: CacheService,
  ) {}

  protected async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected async isAlreadyInStatus(
    orderId: string,
    status: OrderStatus,
  ): Promise<boolean> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    return order?.status === status;
  }

  protected async hasKey(key: string): Promise<boolean> {
    return !!(await this.cacheService.get(key));
  }

  protected async setKey(key: string, ttl = 3600): Promise<void> {
    await this.cacheService.set(key, '1', ttl);
  }

  protected async removeKey(key: string): Promise<void> {
    await this.cacheService.delete(key);
  }

  abstract execute(job: Job<T>, logger: Logger): Promise<void>;
}
