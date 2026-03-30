import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { OrderStatus } from '../enums/order-status.enum';
import { BaseOrderJobStrategy } from './base-order-job.strategy';
import { DeliverOrderJobPayload } from '../processors/payloads/order-job.payload';
import { delay } from '../../../shared/helpers/functions';
import { NotifyUserJobData } from '../../events/processors/payloads/notify-user.payload';
import { Transactional } from '@/shared/decorators/transactional.decorator';
import { OutboxType } from '@/shared/modules/outbox/enums/outbox-type.enum';
import { CacheService } from '../../cache/cache.service';
import { OutboxService } from '@/shared/modules/outbox/outbox.service';
import { OrderRepository } from '../repositories/order.repository';
import { DataSource } from 'typeorm';

@Injectable()
export class DeliverOrderStrategy extends BaseOrderJobStrategy<DeliverOrderJobPayload> {
  constructor(
    cacheService: CacheService,
    outboxService: OutboxService,
    orderRepository: OrderRepository,
    dataSource: DataSource,
  ) {
    super(cacheService, outboxService, orderRepository, dataSource);
  }

  async execute(
    job: Job<DeliverOrderJobPayload>,
    logger: Logger,
  ): Promise<void> {
    const { jobId, orderId, userId, userName } = job.data;

    const key = `idempotency:order:deliver:${jobId}`;
    if (await this.hasKey(key)) return;
    await this.setKey(key);

    if (await this.isAlreadyInStatus(orderId, OrderStatus.DELIVERED)) {
      logger.log(`Order ${orderId} is already in DELIVERED status`);
      return;
    }

    logger.log(`Delivering order ${orderId}`);

    try {
      await this.simulateDelivery(logger);

      // Atomic transaction to update order status and publish events
      await this.finalizeOrderDelivering(orderId, userId, userName);

      logger.log(`Order ${orderId} delivered`);
    } catch (error) {
      await this.removeKey(key);
      throw error;
    }
  }

  private async simulateDelivery(logger: Logger) {
    await delay(3000);
    logger.log('Delivery OK');
  }

  @Transactional()
  private async finalizeOrderDelivering(
    orderId: string,
    userId: string,
    userName: string,
  ) {
    await this.orderRepository.update(orderId, {
      status: OrderStatus.DELIVERED,
    });

    // Add to the Outbox for sending notification to the user
    await this.outboxService.add(
      OutboxType.EVENTS_NOTIFY_USER,
      new NotifyUserJobData(
        userId,
        userName,
        `<To user ${userName}>: Your order with id ${orderId} has been delivered successfully!`,
      ),
    );
  }
}
