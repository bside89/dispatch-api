import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { OrderStatus } from '../enums/order-status.enum';
import { DeliverOrderJob } from '../interfaces/deliver-order-job.interface';
import { BaseJobStrategy } from './job-processing.strategy';

@Injectable()
export class DeliverOrderStrategy extends BaseJobStrategy<DeliverOrderJob> {
  async execute(job: Job<DeliverOrderJob>, logger: Logger): Promise<void> {
    const { orderId } = job.data;

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

      // Send notification to the queue
      await this.notifyCustomer(OrderStatus.DELIVERED, orderId);

      logger.log(`Order ${orderId} delivered`);
    } catch (error) {
      await this.removeKey(key);
      throw error;
    }
  }

  private async simulateDelivery(logger: Logger) {
    await this.delay(3000);
    logger.debug('Delivery simulated');
  }
}
