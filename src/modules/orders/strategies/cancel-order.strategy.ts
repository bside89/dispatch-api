import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { BaseOrderJobStrategy } from './base-order-job.strategy';
import { OrderStatus } from '../enums/order-status.enum';
import { CancelOrderJobData } from '../misc/order-job-data';
import { delay } from '../../../shared/helpers/functions';
import { NotifyUserJobData } from '../../events/misc/events-job-data';

@Injectable()
export class CancelOrderStrategy extends BaseOrderJobStrategy<CancelOrderJobData> {
  async execute(job: Job<CancelOrderJobData>, logger: Logger): Promise<void> {
    const { orderId, userId } = job.data;

    // Idempotency check
    const key = `idempotency:order:cancel:${orderId}`;
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
      await this.releaseInventory(orderId, logger);
      await this.processRefund(orderId, logger);

      await this.orderRepository.update(orderId, {
        status: OrderStatus.CANCELLED,
      });

      // Send notification to the event bus
      await this.eventBus.publish(
        new NotifyUserJobData(
          userId,
          `TO CUSTOMER: Your order with id ${orderId} has been cancelled and refunded successfully!`,
        ),
      );

      logger.log(`Order ${orderId} cancelled`);
    } catch (error) {
      await this.removeKey(key);
      throw error;
    }
  }

  private async releaseInventory(orderId: string, logger: Logger) {
    await delay(800);
    logger.log(`Inventory released`);
  }

  private async processRefund(orderId: string, logger: Logger) {
    await delay(2000);
    logger.log(`Refund processed`);
  }
}
