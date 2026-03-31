import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { BaseOrderJobStrategy } from './base-order-job.strategy';
import { OrderStatus } from '../enums/order-status.enum';
import { CancelOrderJobPayload } from '../processors/payloads/order-job.payload';
import { NotifyUserJobData } from '../../../shared/modules/events/payloads/notify-user.payload';
import { delay } from '../../../shared/helpers/functions';
import { Transactional } from '@/shared/decorators/transactional.decorator';
import { OutboxType } from '@/shared/modules/outbox/enums/outbox-type.enum';
import { CacheService } from '../../cache/cache.service';
import { OutboxService } from '@/shared/modules/outbox/outbox.service';
import { OrderRepository } from '../repositories/order.repository';
import { DataSource } from 'typeorm';

@Injectable()
export class CancelOrderStrategy extends BaseOrderJobStrategy<CancelOrderJobPayload> {
  constructor(
    cacheService: CacheService,
    outboxService: OutboxService,
    orderRepository: OrderRepository,
    dataSource: DataSource,
  ) {
    super(cacheService, outboxService, orderRepository, dataSource);
  }

  async execute(
    job: Job<CancelOrderJobPayload>,
    logger: Logger,
  ): Promise<void> {
    const { jobId, orderId } = job.data;

    const key = `idempotency:order:cancel:${jobId}`;
    if (await this.hasKey(key)) return;
    await this.setKey(key);

    if (
      await this.isAlreadyInStatusArray(orderId, [
        OrderStatus.CANCELLED,
        OrderStatus.REFUNDED,
      ])
    ) {
      logger.log(`Order ${orderId} is already in CANCELLED or REFUNDED status`);
      return;
    }

    logger.log(`Cancelling order ${orderId}`);

    try {
      await this.releaseInventory(job.data, logger);
      await this.processRefund(job.data, logger);

      // Atomic transaction to update order status and publish events
      await this.finalizeOrderCancelling(job.data);

      logger.log(`Order ${orderId} cancelled`);
    } catch (error) {
      await this.removeKey(key);
      throw error;
    }
  }

  private async releaseInventory(data: CancelOrderJobPayload, logger: Logger) {
    await delay(800);
    logger.log(`Inventory released`);
  }

  private async processRefund(data: CancelOrderJobPayload, logger: Logger) {
    await delay(2000);
    logger.log(`Refund processed`);
  }

  @Transactional()
  private async finalizeOrderCancelling(data: CancelOrderJobPayload) {
    const { orderId, userId, userName } = data;

    await this.orderRepository.update(orderId, {
      status: OrderStatus.CANCELLED,
    });

    // Add to the Outbox for sending notification to the user
    await this.outboxService.add(
      OutboxType.EVENTS_NOTIFY_USER,
      new NotifyUserJobData(
        userId,
        userName,
        `<To user ${userName}>: Your order with id ${orderId} has been cancelled successfully!`,
      ),
    );
  }
}
