import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { OrderStatus } from '../enums/order-status.enum';
import {
  CancelOrderJobPayload,
  RefundOrderJobPayload,
} from '../processors/payloads/order-job.payload';
import { NotifyUserJobPayload } from '../../../shared/modules/events/processors/payloads/notify-user.payload';
import { delay } from '../../../shared/helpers/functions';
import { Transactional } from '@/shared/decorators/transactional.decorator';
import { OutboxType } from '@/shared/modules/outbox/enums/outbox-type.enum';
import { CacheService } from '../../../shared/modules/cache/cache.service';
import { OutboxService } from '@/shared/modules/outbox/outbox.service';
import { OrderRepository } from '../repositories/order.repository';
import { DataSource } from 'typeorm';
import { JobStatus } from '@/shared/enums/job-status.enum';
import { BaseOrderJobStrategy } from './base-order-job.strategy';
import Redlock from 'redlock';

@Injectable()
export class CancelOrderJobStrategy extends BaseOrderJobStrategy<CancelOrderJobPayload> {
  constructor(
    protected readonly cacheService: CacheService,
    protected readonly outboxService: OutboxService,
    protected readonly orderRepository: OrderRepository,
    protected readonly dataSource: DataSource, // Used in @Transactional()
    protected readonly redlock: Redlock, // Used in @UseLock()
  ) {
    super(
      CancelOrderJobStrategy.name,
      cacheService,
      orderRepository,
      dataSource,
      redlock,
    );
  }

  @Transactional()
  async execute(job: Job<CancelOrderJobPayload>): Promise<void> {
    const { orderId } = job.data;

    const order = await this.getAndValidate(orderId, OrderStatus.CANCELLED);
    if (!order) return;

    this.logger.log(
      `Cancelling order, attempt ${job.attemptsMade + 1} of ${job.opts.attempts}`,
      { orderId },
    );

    await this.releaseInventory(job.data);

    await this.finish(job.data);
  }

  @Transactional()
  async executeAfterFail(
    job: Job<CancelOrderJobPayload>,
    error: Error,
  ): Promise<void> {
    const { orderId } = job.data;

    this.logger.error(
      `[CRITICAL] Failed to cancel order after all retries: ${error.message}`,
      { orderId },
    );
  }

  private async releaseInventory(data: CancelOrderJobPayload) {
    await delay(2000);
    this.logger.log(`Inventory released for order`, { orderId: data.orderId });
  }

  private async finish(data: CancelOrderJobPayload) {
    const { orderId, userId, userName } = data;

    await this.lockAndUpdateOrder(orderId, { status: OrderStatus.CANCELLED });

    // Notify the user
    await this.outboxService.add(
      OutboxType.EVENTS_NOTIFY_USER,
      new NotifyUserJobPayload(
        userId,
        userName,
        `<To user ${userName}>: Your order with id ${orderId} has been cancelled.`,
      ),
    );

    this.logger.log(`Order moved to CANCELLED`, { orderId });
  }
}
