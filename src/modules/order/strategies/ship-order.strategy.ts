import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { OrderStatus } from '../enums/order-status.enum';
import { ShipOrderJob } from '../interfaces/ship-order-job.interface';
import { BaseJobStrategy } from './job-processing.strategy';
import { OrderJob } from '../enums/order-job.enum';

@Injectable()
export class ShipOrderStrategy extends BaseJobStrategy<ShipOrderJob> {
  async execute(job: Job<ShipOrderJob>, logger: Logger): Promise<void> {
    const { orderId } = job.data;

    // Idempotency check
    const key = `idempotency:order:ship:${orderId}`;
    if (await this.hasKey(key)) return;
    await this.setKey(key);

    if (await this.isAlreadyInStatus(orderId, OrderStatus.SHIPPED)) {
      logger.debug(`Order ${orderId} is already in SHIPPED status`);
      return;
    }

    try {
      logger.log(`Shipping order ${orderId}`);

      await this.simulateShipping(logger);

      await this.orderRepository.update(orderId, {
        status: OrderStatus.SHIPPED,
      });

      // Send notification to the queue
      await this.notifyCustomer(OrderStatus.SHIPPED, orderId);

      // Trigger delivery job after shipping
      await this.orderQueue.add(
        OrderJob.DELIVER_ORDER,
        { orderId },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        },
      );
    } catch (error) {
      await this.removeKey(key);
      throw error;
    }
  }

  private async simulateShipping(logger: Logger) {
    await this.delay(2000);
    logger.debug('Shipping simulated');
  }
}
