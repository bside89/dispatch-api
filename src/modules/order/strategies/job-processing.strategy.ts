import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { OrderStatus } from '../enums/order-status.enum';
import { CacheService } from '../../cache/cache.service';
import { Order } from '../entities/order.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { JobQueue } from '../../common/enums/job-queue.enum';
import { OrderJob } from '../enums/order-job.enum';

export interface JobProcessingStrategy<T = any> {
  execute(job: Job<T>, logger: Logger): Promise<void>;
}

export abstract class BaseJobStrategy<
  T = any,
> implements JobProcessingStrategy<T> {
  constructor(
    @InjectQueue(JobQueue.ORDER_FLOW)
    protected readonly orderQueue: Queue,
    @InjectRepository(Order)
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

  protected async isAlreadyInStatusArray(
    orderId: string,
    statuses: OrderStatus[],
  ): Promise<boolean> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    return order ? statuses.includes(order.status as OrderStatus) : false;
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

  protected async notifyCustomer(status: OrderStatus, orderId: string) {
    await this.orderQueue.add(
      OrderJob.NOTIFICATION_ORDER,
      { orderId, newStatus: status },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );
  }

  abstract execute(job: Job<T>, logger: Logger): Promise<void>;
}
