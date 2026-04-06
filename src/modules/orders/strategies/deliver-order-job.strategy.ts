import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { OrderStatus } from '../enums/order-status.enum';
import {
  DeliverOrderJobPayload,
  RefundOrderJobPayload,
} from '../processors/payloads/order-job.payload';
import { delay, ensureError } from '@/shared/helpers/functions';
import { NotifyUserJobPayload } from '@/shared/modules/events/processors/payloads/notify-user.payload';
import { Transactional } from '@/shared/decorators/transactional.decorator';
import { OutboxType } from '@/shared/modules/outbox/enums/outbox-type.enum';
import { CacheService } from '../../../shared/modules/cache/cache.service';
import { OutboxService } from '@/shared/modules/outbox/outbox.service';
import { OrderRepository } from '../repositories/order.repository';
import { DataSource } from 'typeorm';
import { BaseOrderJobStrategy } from './base-order-job.strategy';
import Redlock from 'redlock';

@Injectable()
export class DeliverOrderJobStrategy extends BaseOrderJobStrategy<DeliverOrderJobPayload> {
  constructor(
    protected readonly cacheService: CacheService,
    protected readonly outboxService: OutboxService,
    protected readonly orderRepository: OrderRepository,
    protected readonly dataSource: DataSource, // Used in @Transactional()
    protected readonly redlock: Redlock, // Used in @UseLock()
  ) {
    super(
      DeliverOrderJobStrategy.name,
      cacheService,
      orderRepository,
      dataSource,
      redlock,
    );
  }

  @Transactional()
  async execute(job: Job<DeliverOrderJobPayload>): Promise<void> {
    const { orderId } = job.data;

    const order = await this.getAndValidate(orderId, OrderStatus.DELIVERED);
    if (!order) return;

    this.logger.log(
      `Delivering order, attempt ${job.attemptsMade + 1} of ${job.opts.attempts}`,
      { orderId },
    );

    await this.simulateDelivery(job.data);

    await this.finish(job.data);
  }

  @Transactional()
  async executeAfterFail(
    job: Job<DeliverOrderJobPayload>,
    error: Error,
  ): Promise<void> {
    const { orderId } = job.data;

    this.logger.error(
      `Failed to deliver order after all retries: ${error.message}`,
      { orderId },
    );

    try {
      await this.compensationLogic(job.data);
    } catch (e) {
      const error = ensureError(e);

      this.logger.error(
        `[CRITICAL] Compensation logic failed for delivering order: ${error.message}`,
        { orderId },
      );
    }
  }

  private async compensationLogic(data: DeliverOrderJobPayload) {
    const { orderId, userId, userName } = data;

    // Refund job
    await this.outboxService.add(
      OutboxType.ORDER_REFUND,
      new RefundOrderJobPayload(userId, orderId, userName),
    );
  }

  private async simulateDelivery(data: DeliverOrderJobPayload) {
    await delay(3000);
    this.logger.log(`Delivery OK`, { orderId: data.orderId });
  }

  private async finish(data: DeliverOrderJobPayload) {
    const { orderId, userId, userName } = data;

    await this.lockAndUpdateOrder(orderId, { status: OrderStatus.DELIVERED });

    // Notify the user
    await this.outboxService.add(
      OutboxType.EVENTS_NOTIFY_USER,
      new NotifyUserJobPayload(
        userId,
        userName,
        `<To user ${userName}>: Your order with id ${orderId} has been delivered successfully.`,
      ),
    );

    this.logger.log(`Order moved to DELIVERED`, { orderId });
  }
}
