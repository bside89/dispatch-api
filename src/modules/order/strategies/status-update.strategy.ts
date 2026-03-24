import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { BaseJobStrategy } from './job-processing.strategy';
import { StatusUpdateJob } from '../interfaces/status-update-job.interfaces';
import { StatusActionFactory } from '../factories/status-action.factory';
import { OrderStatus } from '../enums/order-status.enum';
import { Order } from '../entities/order.entity';
import { Repository } from 'typeorm';
import { CacheService } from '../../cache/cache.service';

@Injectable()
export class StatusUpdateStrategy extends BaseJobStrategy<StatusUpdateJob> {
  constructor(
    protected readonly orderRepository: Repository<Order>,
    protected readonly cacheService: CacheService,
    protected readonly factory: StatusActionFactory,
  ) {
    super(orderRepository, cacheService);
  }

  async execute(job: Job<StatusUpdateJob>, logger: Logger): Promise<void> {
    const { orderId, newStatus } = job.data;

    const key = `idempotency:order:status:${orderId}:${newStatus}`;

    // Idempotency check
    if (await this.hasKey(key)) return;

    if (await this.isAlreadyInStatus(orderId, newStatus as OrderStatus)) return;

    await this.setKey(key);

    logger.log(`Updating order ${orderId} → ${newStatus}`);

    try {
      await this.sendStatusNotification(job.data, logger);

      // Trigger any side effects for the new status
      const action = this.factory.createAction(newStatus as OrderStatus);
      if (action) {
        await action.execute(orderId, logger);
      }

      await this.orderRepository.update(orderId, {
        status: newStatus,
      });

      logger.log(`Status updated`);
    } catch (error) {
      await this.removeKey(key);
      throw error;
    }
  }

  private async sendStatusNotification(data: StatusUpdateJob, logger: Logger) {
    await this.delay(300);
    logger.debug(`Notification sent`);
  }
}
