import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { BaseOrderJobStrategy } from './base-order-job.strategy';
import { OrderStatus } from '../enums/order-status.enum';
import {
  ProcessOrderJobPayload,
  ShipOrderJobPayload,
} from '../processors/payloads/order-job.payload';
import { NotifyUserJobData } from '../../../shared/modules/events/processors/payloads/notify-user.payload';
import { delay } from '../../../shared/helpers/functions';
import { Transactional } from '@/shared/decorators/transactional.decorator';
import { OutboxType } from '@/shared/modules/outbox/enums/outbox-type.enum';
import { CacheService } from '../../cache/cache.service';
import { OutboxService } from '@/shared/modules/outbox/outbox.service';
import { OrderRepository } from '../repositories/order.repository';
import { DataSource } from 'typeorm';

@Injectable()
export class ProcessOrderStrategy extends BaseOrderJobStrategy<ProcessOrderJobPayload> {
  constructor(
    cacheService: CacheService,
    outboxService: OutboxService,
    orderRepository: OrderRepository,
    dataSource: DataSource,
  ) {
    super(cacheService, outboxService, orderRepository, dataSource);
  }

  async execute(
    job: Job<ProcessOrderJobPayload>,
    logger: Logger,
  ): Promise<void> {
    const { jobId, orderId } = job.data;
    const key = `idempotency:order:process:${jobId}`;

    if (await this.hasKey(key)) return;
    await this.setKey(key);

    logger.log(`Processing order ${orderId}`);

    try {
      await this.validateOrder(job.data, logger);
      await this.processPayment(job.data, logger);
      await this.reserveInventory(job.data, logger);

      // Atomic transaction to update order status and publish events
      await this.finalizeOrderProcessing(job.data);

      logger.log(`Order ${orderId} moved to PROCESSED`);
    } catch (error) {
      await this.removeKey(key);
      throw error;
    }
  }

  private async validateOrder(data: ProcessOrderJobPayload, logger: Logger) {
    await delay(1000);
    if (data.total <= 0) throw new Error('Invalid order total');
    logger.log(`Validation OK`);
  }

  private async processPayment(data: ProcessOrderJobPayload, logger: Logger) {
    await delay(2000);
    logger.log(`Payment OK`);
  }

  private async reserveInventory(data: ProcessOrderJobPayload, logger: Logger) {
    await delay(1500);
    logger.log(`Inventory OK`);
  }

  @Transactional()
  private async finalizeOrderProcessing(data: ProcessOrderJobPayload) {
    const { orderId, userId, userName } = data;

    await this.orderRepository.update(orderId, {
      status: OrderStatus.PROCESSED,
    });

    // Add to the Outbox for sending notification to the user (Event Bus)
    await this.outboxService.add(
      OutboxType.EVENTS_NOTIFY_USER,
      new NotifyUserJobData(
        userId,
        userName,
        `<To user ${userName}>: Your order with id ${orderId} has been processed successfully!`,
      ),
    );

    // Add to the Outbox for shipping the order (job)
    await this.outboxService.add(
      OutboxType.ORDER_SHIP,
      new ShipOrderJobPayload(userId, orderId, userName),
    );
  }
}
