import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { OrderStatus } from '../enums/order-status.enum';
import {
  DeliverOrderJobPayload,
  ShipOrderJobPayload,
} from '../processors/payloads/order-job.payload';
import { delay } from '../../../shared/helpers/functions';
import { NotifyUserJobPayload } from '../../../shared/modules/events/processors/payloads/notify-user.payload';
import { Transactional } from '@/shared/decorators/transactional.decorator';
import { OutboxType } from '@/shared/modules/outbox/enums/outbox-type.enum';
import { CacheService } from '../../cache/cache.service';
import { OutboxService } from '@/shared/modules/outbox/outbox.service';
import { OrderRepository } from '../repositories/order.repository';
import { DataSource } from 'typeorm';
import { JobStatus } from '@/shared/enums/job-status.enum';
import { BaseOrderJobStrategy } from './base-order-job.strategy';
import Redlock from 'redlock';

@Injectable()
export class ShipOrderJobStrategy extends BaseOrderJobStrategy<ShipOrderJobPayload> {
  constructor(
    protected readonly outboxService: OutboxService,
    protected readonly orderRepository: OrderRepository,
    protected readonly cacheService: CacheService,
    protected readonly dataSource: DataSource, // Used in @Transactional()
    protected readonly redlock: Redlock, // Used in @UseLock()
  ) {
    super(
      ShipOrderJobStrategy.name,
      cacheService,
      orderRepository,
      dataSource,
      redlock,
    );
  }

  @Transactional()
  async execute(job: Job<ShipOrderJobPayload>): Promise<void> {
    const { jobId, orderId } = job.data;
    const idempotencyKey = this.cacheKeyIdempotency(jobId);

    const idempotencyValue = await this.getIdempotency(idempotencyKey);
    if (idempotencyValue && idempotencyValue !== JobStatus.FAILED) {
      return;
    }
    await this.setIdempotency(idempotencyKey, JobStatus.IN_PROGRESS);

    try {
      if (
        !(await this.orderRepository.existsByStatusIn(orderId, [OrderStatus.PAID]))
      ) {
        this.logger.log(`Order ${orderId} is not in PAID status or does not exist`);
        await this.setIdempotency(idempotencyKey, JobStatus.COMPLETED);
        return;
      }

      this.logger.log(
        `Shipping order ${orderId}, attempt ${job.attemptsMade + 1} of ${job.opts.attempts}`,
      );

      await this.simulateShipping(job.data);

      await this.finish(job.data);

      await this.setIdempotency(idempotencyKey, JobStatus.COMPLETED);
    } catch (error: any) {
      await this.setIdempotency(idempotencyKey, JobStatus.FAILED);

      throw error;
    }
  }

  @Transactional()
  async executeOnFailed(job: Job<ShipOrderJobPayload>, error: Error): Promise<void> {
    const { orderId } = job.data;

    this.logger.error(
      `Failed to ship order ${orderId} after all retries: ${error.message}`,
    );

    try {
      await this.compensationLogic(job.data);
    } catch (error: any) {
      this.logger.error(
        `[CRITICAL] Compensation logic failed for shipping order ${orderId}: ${error.message}`,
      );
    }
  }

  private async compensationLogic(data: ShipOrderJobPayload) {
    // TODO: Implement a RefundOrderStrategy and call it here instead of just logging
    this.logger.log(`Compensation logic executed for order ${data.orderId}`);
  }

  private async simulateShipping(data: ShipOrderJobPayload) {
    await delay(2000);
    this.logger.log(`Shipping OK for order ${data.orderId}`);
  }

  private async finish(data: ShipOrderJobPayload) {
    const { orderId, userId, userName } = data;

    await this.updateOrderStatus(orderId, OrderStatus.SHIPPED);

    // Add to the Outbox for sending notification to the user (Event Bus)
    await this.outboxService.add(
      OutboxType.EVENTS_NOTIFY_USER,
      new NotifyUserJobPayload(
        userId,
        userName,
        `<To user ${userName}>: Your order with id ${orderId} has been shipped successfully!`,
      ),
    );

    // Add to the Outbox for delivering the order (job)
    await this.outboxService.add(
      OutboxType.ORDER_DELIVER,
      new DeliverOrderJobPayload(userId, orderId, userName),
    );

    this.logger.log(`Order ${orderId} moved to SHIPPED`);
  }

  // Methods for creating cache keys

  private cacheKeyIdempotency(jobId: string): string {
    return `idempotency:order:ship:${jobId}`;
  }
}
