import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { OrderStatus } from '../enums/order-status.enum';
import {
  ProcessOrderJobPayload,
  ShipOrderJobPayload,
} from '../processors/payloads/order-job.payload';
import { NotifyUserJobPayload } from '@/shared/modules/events/processors/payloads/notify-user.payload';
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
import { ORDER_KEY } from '../constants/order.key';

@Injectable()
export class ProcessOrderJobStrategy extends BaseOrderJobStrategy<ProcessOrderJobPayload> {
  private readonly PAYMENT_IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000; // 24 hours

  constructor(
    protected readonly cacheService: CacheService,
    protected readonly outboxService: OutboxService,
    protected readonly orderRepository: OrderRepository,
    protected readonly dataSource: DataSource, // Used in @Transactional()
    protected readonly redlock: Redlock, // Used in @UseLock()
  ) {
    super(
      ProcessOrderJobStrategy.name,
      cacheService,
      orderRepository,
      dataSource,
      redlock,
    );
  }

  @Transactional()
  async execute(job: Job<ProcessOrderJobPayload>): Promise<void> {
    const { jobId, orderId } = job.data;
    const idempotencyKey = ORDER_KEY.IDEMPOTENCY('job', jobId);

    const idempotencyValue = await this.getIdempotency(idempotencyKey);
    if (idempotencyValue && idempotencyValue !== JobStatus.FAILED) {
      return;
    }
    await this.setIdempotency(idempotencyKey, JobStatus.IN_PROGRESS);

    try {
      if (!(await this.orderRepository.hasStatus(orderId, [OrderStatus.PENDING]))) {
        this.logger.log(
          `Order ${orderId} is not in PENDING status or does not exist`,
        );
        await this.setIdempotency(idempotencyKey, JobStatus.COMPLETED);
        return;
      }

      this.logger.log(
        `Processing order, attempt ${job.attemptsMade + 1} of ${job.opts.attempts}`,
        { orderId },
      );

      const isPaid = await this.cacheService.get<boolean>(
        ORDER_KEY.VALIDATE_IF_PAID(orderId),
      );
      if (!isPaid) {
        await this.processPayment(job.data);
      }
      await this.cacheService.set(
        ORDER_KEY.VALIDATE_IF_PAID(orderId),
        true,
        this.PAYMENT_IDEMPOTENCY_TTL,
      );

      await this.finish(job.data);

      await this.setIdempotency(idempotencyKey, JobStatus.COMPLETED);
    } catch (error) {
      await this.setIdempotency(idempotencyKey, JobStatus.FAILED);

      throw error;
    }
  }

  @Transactional()
  async executeOnFailed(
    job: Job<ProcessOrderJobPayload>,
    error: Error,
  ): Promise<void> {
    const { orderId } = job.data;

    this.logger.error(
      `Failed to process payment for order after all retries: ${error.message}`,
      { orderId },
    );

    try {
      await this.compensationLogic(job.data);
    } catch (error: any) {
      this.logger.error(
        `[CRITICAL] Compensation logic failed for processing order: ${error.message}`,
        { orderId },
      );
    }
  }

  private async compensationLogic(data: ProcessOrderJobPayload) {
    // TODO: Implement a RefundOrderStrategy and call it here instead of just logging
    const isPaid = await this.cacheService.get<boolean>(
      ORDER_KEY.VALIDATE_IF_PAID(data.orderId),
    );
    if (isPaid) {
      await this.refundPayment(data);
    }
    await this.cacheService.set(
      ORDER_KEY.VALIDATE_IF_PAID(data.orderId),
      false,
      this.PAYMENT_IDEMPOTENCY_TTL,
    );

    await this.releaseInventory(data);
  }

  private async processPayment(data: ProcessOrderJobPayload) {
    if (Math.random() < 0.1) throw new Error('Random payment error');
    await delay(2000);
    this.logger.log('Payment OK', { orderId: data.orderId });
  }

  private async refundPayment(data: ProcessOrderJobPayload) {
    await delay(1000);
    this.logger.warn('Payment refunded', { orderId: data.orderId });
  }

  private async releaseInventory(data: ProcessOrderJobPayload) {
    await delay(1000);
    this.logger.warn('Inventory released', { orderId: data.orderId });
  }

  private async finish(data: ProcessOrderJobPayload) {
    const { orderId, userId, userName } = data;

    await this.updateOrderStatus(orderId, OrderStatus.PAID);

    // Add to the Outbox for sending notification to the user (Event Bus)
    await this.outboxService.add(
      OutboxType.EVENTS_NOTIFY_USER,
      new NotifyUserJobPayload(
        userId,
        userName,
        `<To user ${userName}>: Your order with id ${orderId} has been paid successfully.`,
      ),
    );

    // Add to the Outbox for shipping the order (job)
    await this.outboxService.add(
      OutboxType.ORDER_SHIP,
      new ShipOrderJobPayload(userId, orderId, userName),
    );

    this.logger.log(`Order moved to PAID`, { orderId });
  }
}
