import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job, Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { BaseJobStrategy } from './job-processing.strategy';
import { NotificationJob } from '../interfaces/notification-job.interfaces';
import { StatusNotificationFactory as StatusNotificationFactory } from '../factories/status-notification.factory';
import { OrderStatus } from '../enums/order-status.enum';
import { Order } from '../entities/order.entity';
import { CacheService } from '../../cache/cache.service';
import { InjectQueue } from '@nestjs/bullmq';
import { JobQueue } from '../../common/enums/job-queue.enum';

@Injectable()
export class NotificationStrategy extends BaseJobStrategy<NotificationJob> {
  constructor(
    @InjectQueue(JobQueue.ORDER_FLOW)
    protected readonly orderQueue: Queue,
    @InjectRepository(Order)
    protected readonly orderRepository: Repository<Order>,

    protected readonly cacheService: CacheService,
    protected readonly factory: StatusNotificationFactory,
  ) {
    super(orderQueue, orderRepository, cacheService);
  }

  async execute(job: Job<NotificationJob>, logger: Logger): Promise<void> {
    const { orderId, newStatus } = job.data;

    const key = `idempotency:order:status:${orderId}:${newStatus}`;

    // Idempotency check
    if (await this.hasKey(key)) return;
    await this.setKey(key);

    logger.log(`Notifying customer about order ${orderId} → ${newStatus}`);

    try {
      // Notify the customer about the status change
      const action = this.factory.createNotification(newStatus as OrderStatus);
      if (action) {
        await action.execute(orderId, logger);
      }
    } catch (error) {
      await this.removeKey(key);
      throw error;
    }
  }
}
