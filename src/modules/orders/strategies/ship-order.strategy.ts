import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { OrderStatus } from '../enums/order-status.enum';
import { BaseOrderJobStrategy } from './base-order-job.strategy';
import { OrderJob } from '../enums/order-job.enum';
import { DeliverOrderJobData, ShipOrderJobData } from '../misc/order-job-data';
import { delay } from '../../../shared/helpers/functions';
import { NotifyUserJobData } from '../../events/misc/events-job-data';

@Injectable()
export class ShipOrderStrategy extends BaseOrderJobStrategy<ShipOrderJobData> {
  async execute(job: Job<ShipOrderJobData>, logger: Logger): Promise<void> {
    const { userId, orderId } = job.data;

    // Idempotency check
    const key = `idempotency:order:ship:${orderId}`;
    if (await this.hasKey(key)) return;
    await this.setKey(key);

    if (await this.isAlreadyInStatus(orderId, OrderStatus.SHIPPED)) {
      logger.log(`Order ${orderId} is already in SHIPPED status`);
      return;
    }

    try {
      logger.log(`Shipping order ${orderId}`);

      await this.simulateShipping(logger);

      await this.orderRepository.update(orderId, {
        status: OrderStatus.SHIPPED,
      });

      // Send notification to the event bus
      await this.eventBus.publish(
        new NotifyUserJobData(
          userId,
          `TO CUSTOMER: Your order with id ${orderId} has been shipped successfully!`,
        ),
      );

      // Trigger delivery job after shipping
      await this.orderQueue.add(
        OrderJob.DELIVER_ORDER,
        new DeliverOrderJobData(userId, orderId),
      );
    } catch (error) {
      await this.removeKey(key);
      throw error;
    }
  }

  private async simulateShipping(logger: Logger) {
    await delay(2000);
    logger.log('Shipping OK');
  }
}
