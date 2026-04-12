import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { OrderStatus } from '../enums/order-status.enum';
import { RefundOrderJobPayload } from '../../../shared/payloads/order-job.payload';
import { NotifyUserJobPayload } from '@/shared/payloads/event-job.payload';
import { Transactional } from '@/shared/decorators/transactional.decorator';
import { OutboxType } from '@/shared/modules/outbox/enums/outbox-type.enum';
import { CacheService } from '../../../shared/modules/cache/cache.service';
import { OutboxService } from '@/shared/modules/outbox/outbox.service';
import { OrderRepository } from '../repositories/order.repository';
import { DataSource } from 'typeorm';
import { BaseOrderJobStrategy } from './base-order-job.strategy';
import Redlock from 'redlock';
import { delay } from '@/shared/helpers/functions';
import { Order } from '../entities/order.entity';

@Injectable()
export class RefundOrderJobStrategy extends BaseOrderJobStrategy<RefundOrderJobPayload> {
  constructor(
    private readonly outboxService: OutboxService,
    cacheService: CacheService,
    orderRepository: OrderRepository,
    dataSource: DataSource,
    redlock: Redlock,
  ) {
    super(
      RefundOrderJobStrategy.name,
      cacheService,
      orderRepository,
      dataSource,
      redlock,
    );
  }

  @Transactional()
  async execute(job: Job<RefundOrderJobPayload>): Promise<void> {
    const { orderId } = job.data;

    const order = await this.getAndValidate(orderId, OrderStatus.REFUNDED);
    if (!order) return;

    this.logger.log(
      `Refunding order, attempt ${job.attemptsMade + 1} of ${job.opts.attempts}`,
      { orderId },
    );

    await this.refundPayment(job.data, order);

    await this.finish(job.data);
  }

  @Transactional()
  async executeAfterFail(
    job: Job<RefundOrderJobPayload>,
    error: Error,
  ): Promise<void> {
    const { orderId } = job.data;

    this.logger.error(
      `[CRITICAL] Failed to refund order after all retries: ${error.message}`,
      { orderId },
    );
  }

  private async refundPayment(data: RefundOrderJobPayload, order: Order) {
    const { orderId } = data;

    if (!order.paid) {
      this.logger.log(`Order ${orderId} is not paid, skipping refund`);
      return;
    }

    await delay(1000);

    await this.updateOrderWithLock(orderId, { paid: false });

    this.logger.log(`Refund OK`, { orderId });
  }

  private async finish(data: RefundOrderJobPayload) {
    const { orderId, userId, userName } = data;

    await this.updateOrderWithLock(orderId, { status: OrderStatus.REFUNDED });

    // Add to the outbox for sending notification to the user (Event Bus)
    await this.outboxService.add(
      OutboxType.EVENTS_NOTIFY_USER,
      new NotifyUserJobPayload(
        userId,
        userName,
        `<To user ${userName}>: Your order with id ${orderId} has been refunded successfully.`,
      ),
    );

    this.logger.log(`Order moved to REFUNDED`, { orderId });
  }
}
