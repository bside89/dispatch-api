import { Inject, Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { OrderStatus } from '../enums/order-status.enum';
import { CacheService } from '../../cache/cache.service';
import { Order } from '../entities/order.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { EventBus } from '../../events/interfaces/event-bus.interface';
import { EVENT_BUS } from '../../events/constants/event-bus.token';
import { CACHE_CONFIG } from '@/shared/constants/cache.constant';

export abstract class BaseOrderJobStrategy<T = any> {
  constructor(
    @InjectQueue('orders')
    protected readonly orderQueue: Queue,
    @InjectRepository(Order)
    protected readonly orderRepository: Repository<Order>,
    @Inject(EVENT_BUS)
    protected readonly eventBus: EventBus,

    protected readonly cacheService: CacheService,
  ) {}

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
