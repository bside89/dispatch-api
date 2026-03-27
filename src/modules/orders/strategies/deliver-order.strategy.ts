import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { OrderStatus } from '../enums/order-status.enum';
import { BaseOrderJobStrategy } from './base-order-job.strategy';
import { DeliverOrderJobData } from '../misc/order-job-data';
import { delay } from '../../../shared/helpers/functions';
import { NotifyUserJobData } from '../../events/misc/events-job-data';

@Injectable()
export class DeliverOrderStrategy extends BaseOrderJobStrategy<DeliverOrderJobData> {
  async execute(job: Job<DeliverOrderJobData>, logger: Logger): Promise<void> {
    const { userId, orderId } = job.data;

    // Idempotency check
    const key = `idempotency:order:deliver:${orderId}`;
    if (await this.hasKey(key)) return;
    await this.setKey(key);

    if (await this.isAlreadyInStatus(orderId, OrderStatus.DELIVERED)) {
      logger.debug(`Order ${orderId} is already in DELIVERED status`);
      return;
    }

    try {
      logger.log(`Delivering order ${orderId}`);

      await this.simulateDelivery(logger);

      await this.orderRepository.update(orderId, {
        status: OrderStatus.DELIVERED,
      });

      // Send notification to the event bus
      await this.eventBus.publish(
        new NotifyUserJobData(
          userId,
          `TO CUSTOMER: Your order with id ${orderId} has been delivered successfully!`,
        ),
      );

      logger.log(`Order ${orderId} delivered`);
    } catch (error) {
      await this.removeKey(key);
      throw error;
    }
  }

  private async simulateDelivery(logger: Logger) {
    await delay(3000);
    logger.debug('Delivery OK');
  }
}
