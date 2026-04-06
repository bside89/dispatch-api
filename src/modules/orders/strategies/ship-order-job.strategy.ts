import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { OrderStatus } from '../enums/order-status.enum';
import {
  DeliverOrderJobPayload,
  RefundOrderJobPayload,
  ShipOrderJobPayload,
} from '../processors/payloads/order-job.payload';
import { delay } from '../../../shared/helpers/functions';
import { NotifyUserJobPayload } from '../../../shared/modules/events/processors/payloads/notify-user.payload';
import { Transactional } from '@/shared/decorators/transactional.decorator';
import { OutboxType } from '@/shared/modules/outbox/enums/outbox-type.enum';
import { CacheService } from '../../../shared/modules/cache/cache.service';
import { OutboxService } from '@/shared/modules/outbox/outbox.service';
import { OrderRepository } from '../repositories/order.repository';
import { DataSource } from 'typeorm';
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
    const { orderId } = job.data;

    const order = await this.getAndValidate(orderId, OrderStatus.SHIPPED);
    if (!order) return;

    this.logger.log(
      `Shipping order, attempt ${job.attemptsMade + 1} of ${job.opts.attempts}`,
      { orderId },
    );

    await this.simulateShipping(job.data);

    await this.finish(job.data);
  }

  @Transactional()
  async executeAfterFail(
    job: Job<ShipOrderJobPayload>,
    error: Error,
  ): Promise<void> {
    const { orderId } = job.data;

    this.logger.error(`Failed to ship order after all retries: ${error.message}`, {
      orderId,
    });

    try {
      await this.compensationLogic(job.data, error);
    } catch (error: any) {
      this.logger.error(
        `[CRITICAL] Compensation logic failed for shipping order: ${error.message}`,
        { orderId },
      );
    }
  }

  private async compensationLogic(data: ShipOrderJobPayload, error: Error) {
    const { orderId, userId, userName } = data;

    // Notify the user
    await this.outboxService.add(
      OutboxType.EVENTS_NOTIFY_USER,
      new NotifyUserJobPayload(
        userId,
        userName,
        `<To user ${userName}>: Your order with id ${orderId} has failed to ship.` +
          `Reason: ${error.message}`,
      ),
    );

    // Refund job
    await this.outboxService.add(
      OutboxType.ORDER_REFUND,
      new RefundOrderJobPayload(userId, orderId, userName),
    );
  }

  private async simulateShipping(data: ShipOrderJobPayload) {
    await delay(2000);
    this.logger.log('Shipping OK', { orderId: data.orderId });
  }

  private async finish(data: ShipOrderJobPayload) {
    const { orderId, userId, userName } = data;

    await this.lockAndUpdateOrder(orderId, { status: OrderStatus.SHIPPED });

    // Notify the user
    await this.outboxService.add(
      OutboxType.EVENTS_NOTIFY_USER,
      new NotifyUserJobPayload(
        userId,
        userName,
        `<To user ${userName}>: Your order with id ${orderId} has been shipped successfully.`,
      ),
    );

    // Deliver job
    await this.outboxService.add(
      OutboxType.ORDER_DELIVER,
      new DeliverOrderJobPayload(userId, orderId, userName),
    );

    this.logger.log(`Order moved to SHIPPED`, { orderId });
  }
}
