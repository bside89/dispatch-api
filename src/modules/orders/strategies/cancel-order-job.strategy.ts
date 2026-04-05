import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { OrderStatus } from '../enums/order-status.enum';
import { CancelOrderJobPayload } from '../processors/payloads/order-job.payload';
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
  private readonly CACHE_KEYS = {
    IDEMPOTENCY: (jobId: string) => `idempotency:order:cancel:${jobId}`,
  };

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
    const { jobId, orderId } = job.data;
    const idempotencyKey = this.CACHE_KEYS.IDEMPOTENCY(jobId);

    const idempotencyValue = await this.getIdempotency(idempotencyKey);
    if (idempotencyValue && idempotencyValue !== JobStatus.FAILED) {
      return;
    }
    await this.setIdempotency(idempotencyKey, JobStatus.IN_PROGRESS);

    try {
      if (
        await this.orderRepository.hasStatus(orderId, [
          OrderStatus.CANCELLED,
          OrderStatus.REFUNDED,
        ])
      ) {
        this.logger.log(
          `Order ${orderId} is in CANCELLED or REFUNDED status or does not exist`,
        );
        await this.setIdempotency(idempotencyKey, JobStatus.COMPLETED);
        return;
      }

      this.logger.log(
        `Cancelling order, attempt ${job.attemptsMade + 1} of ${job.opts.attempts}`,
        { orderId },
      );

      await this.cancelOrder(job.data);

      await this.finish(job.data);
    } catch (error) {
      await this.setIdempotency(idempotencyKey, JobStatus.FAILED);

      throw error;
    } finally {
      await this.setIdempotency(idempotencyKey, JobStatus.COMPLETED);
    }
  }

  @Transactional()
  async executeOnFailed(
    job: Job<CancelOrderJobPayload>,
    error: Error,
  ): Promise<void> {
    const { orderId } = job.data;

    this.logger.error(
      `[CRITICAL] Failed to cancel order after all retries: ${error.message}`,
      { orderId },
    );
  }

  private async cancelOrder(data: CancelOrderJobPayload) {
    await delay(2000);
    this.logger.log(`Cancel for order processed`, { orderId: data.orderId });
  }

  private async finish(data: CancelOrderJobPayload) {
    const { orderId, userId, userName } = data;

    await this.updateOrderStatus(orderId, OrderStatus.CANCELLED);

    // Add to the Outbox for sending notification to the user
    await this.outboxService.add(
      OutboxType.EVENTS_NOTIFY_USER,
      new NotifyUserJobPayload(
        userId,
        userName,
        `<To user ${userName}>: Your order with id ${orderId} has been cancelled successfully.`,
      ),
    );

    // TODO: Add to the Outbox for refund the order (job)

    this.logger.log(`Order moved to CANCELLED`, { orderId });
  }
}
