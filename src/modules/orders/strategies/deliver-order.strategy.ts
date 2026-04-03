import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { OrderStatus } from '../enums/order-status.enum';
import { BaseJobStrategy } from '../../../shared/strategies/base-job.strategy';
import { DeliverOrderJobPayload } from '../processors/payloads/order-job.payload';
import { delay } from '@/shared/helpers/functions';
import { NotifyUserJobPayload } from '@/shared/modules/events/processors/payloads/notify-user.payload';
import { Transactional } from '@/shared/decorators/transactional.decorator';
import { OutboxType } from '@/shared/modules/outbox/enums/outbox-type.enum';
import { CacheService } from '../../cache/cache.service';
import { OutboxService } from '@/shared/modules/outbox/outbox.service';
import { OrderRepository } from '../repositories/order.repository';
import { DataSource } from 'typeorm';
import { JobStatus } from '@/shared/enums/job-status.enum';

@Injectable()
export class DeliverOrderStrategy extends BaseJobStrategy<DeliverOrderJobPayload> {
  constructor(
    protected readonly cacheService: CacheService,
    protected readonly outboxService: OutboxService,
    protected readonly orderRepository: OrderRepository,
    protected readonly dataSource: DataSource,
  ) {
    super(cacheService, DeliverOrderStrategy.name);
  }

  @Transactional()
  async execute(job: Job<DeliverOrderJobPayload>): Promise<void> {
    const { jobId, orderId, userId, userName } = job.data;
    const idempotencyKey = this.cacheKeyIdempotency(jobId);

    const idempotencyValue = await this.getIdempotency(idempotencyKey);
    if (idempotencyValue && idempotencyValue !== JobStatus.FAILED) {
      return;
    }
    await this.setIdempotency(idempotencyKey, JobStatus.IN_PROGRESS);

    try {
      if (
        !(await this.orderRepository.existsByStatusIn(orderId, [
          OrderStatus.SHIPPED,
        ]))
      ) {
        this.logger.log(
          `Order ${orderId} is not in SHIPPED status or does not exist`,
        );
        await this.setIdempotency(idempotencyKey, JobStatus.COMPLETED);
        return;
      }

      this.logger.log(
        `Delivering order ${orderId}, attempt ${job.attemptsMade + 1} of ${job.opts.attempts}`,
      );

      await this.simulateDelivery(job.data);

      await this.finish(orderId, userId, userName);

      await this.setIdempotency(idempotencyKey, JobStatus.COMPLETED);
    } catch (error) {
      await this.setIdempotency(idempotencyKey, JobStatus.FAILED);

      throw error;
    }
  }

  @Transactional()
  async executeOnFailed(
    job: Job<DeliverOrderJobPayload>,
    error: Error,
  ): Promise<void> {
    const { orderId } = job.data;

    this.logger.error(
      `Failed to deliver order ${orderId} after all retries: ${error.message}`,
    );

    try {
      await this.compensationLogic(job.data);
    } catch (error: any) {
      this.logger.error(
        `[CRITICAL] Compensation logic failed for delivering order ${orderId}: ${error.message}`,
      );
    }
  }

  private async compensationLogic(data: DeliverOrderJobPayload) {
    // TODO: Implement a RefundOrderStrategy and call it here instead of just logging
    this.logger.log(`Compensation logic executed for order ${data.orderId}`);
  }

  private async simulateDelivery(data: DeliverOrderJobPayload) {
    await delay(3000);
    this.logger.log(`Delivery OK for order ${data.orderId}`);
  }

  private async finish(orderId: string, userId: string, userName: string) {
    await this.orderRepository.update(orderId, {
      status: OrderStatus.DELIVERED,
    });

    // Add to the Outbox for sending notification to the user (Event Bus)
    await this.outboxService.add(
      OutboxType.EVENTS_NOTIFY_USER,
      new NotifyUserJobPayload(
        userId,
        userName,
        `<To user ${userName}>: Your order with id ${orderId} has been delivered successfully!`,
      ),
    );

    this.logger.log(`Order ${orderId} moved to DELIVERED`);
  }

  private cacheKeyIdempotency(jobId: string): string {
    return `idempotency:order:deliver:${jobId}`;
  }
}
