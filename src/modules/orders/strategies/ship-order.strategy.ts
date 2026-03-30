import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { OrderStatus } from '../enums/order-status.enum';
import { BaseOrderJobStrategy } from './base-order-job.strategy';
import {
  DeliverOrderJobPayload,
  ShipOrderJobPayload,
} from '../processors/payloads/order-job.payload';
import { delay } from '../../../shared/helpers/functions';
import { NotifyUserJobData } from '../../../shared/modules/events/processors/payloads/notify-user.payload';
import { Transactional } from '@/shared/decorators/transactional.decorator';
import { OutboxType } from '@/shared/modules/outbox/enums/outbox-type.enum';
import { CacheService } from '../../cache/cache.service';
import { OutboxService } from '@/shared/modules/outbox/outbox.service';
import { OrderRepository } from '../repositories/order.repository';
import { DataSource } from 'typeorm';

@Injectable()
export class ShipOrderStrategy extends BaseOrderJobStrategy<ShipOrderJobPayload> {
  constructor(
    cacheService: CacheService,
    outboxService: OutboxService,
    orderRepository: OrderRepository,
    dataSource: DataSource,
  ) {
    super(cacheService, outboxService, orderRepository, dataSource);
  }

  async execute(job: Job<ShipOrderJobPayload>, logger: Logger): Promise<void> {
    const { jobId, orderId } = job.data;

    const key = `idempotency:order:ship:${jobId}`;
    if (await this.hasKey(key)) return;
    await this.setKey(key);

    if (await this.isAlreadyInStatus(orderId, OrderStatus.SHIPPED)) {
      logger.log(`Order ${orderId} is already in SHIPPED status`);
      return;
    }

    logger.log(`Shipping order ${orderId}`);

    try {
      await this.simulateShipping(logger);

      // Atomic transaction to update order status and publish events
      await this.finalizeOrderShipping(job.data);

      logger.log(`Order ${orderId} moved to SHIPPED`);
    } catch (error) {
      await this.removeKey(key);
      throw error;
    }
  }

  private async simulateShipping(logger: Logger) {
    await delay(2000);
    logger.log('Shipping OK');
  }

  @Transactional()
  private async finalizeOrderShipping(data: ShipOrderJobPayload) {
    const { orderId, userId, userName } = data;

    await this.orderRepository.update(orderId, {
      status: OrderStatus.SHIPPED,
    });

    // Add to the Outbox for sending notification to the user (Event Bus)
    await this.outboxService.add(
      OutboxType.EVENTS_NOTIFY_USER,
      new NotifyUserJobData(
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
  }
}
