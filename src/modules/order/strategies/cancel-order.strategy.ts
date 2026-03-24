import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { BaseJobStrategy } from './job-processing.strategy';
import { CancelOrderJob } from '../interfaces/cancel-order-job.interfaces';
import { OrderStatus } from '../enums/order-status.enum';

@Injectable()
export class CancelOrderStrategy extends BaseJobStrategy<CancelOrderJob> {
  async execute(job: Job<CancelOrderJob>, logger: Logger): Promise<void> {
    const { orderId, customerId } = job.data;

    const key = `idempotency:order:cancel:${orderId}`;

    // Idempotency check
    if (await this.hasKey(key)) return;

    if (await this.isAlreadyInStatus(orderId, OrderStatus.CANCELLED)) return;

    await this.setKey(key);

    logger.log(`Cancelling order ${orderId}`);

    try {
      await this.releaseInventory(orderId, logger);
      await this.processRefund(orderId, logger);
      await this.notifyCustomerCancellation(customerId, orderId, logger);

      await this.orderRepository.update(orderId, {
        status: OrderStatus.CANCELLED,
      });

      logger.log(`Order ${orderId} cancelled`);
    } catch (error) {
      await this.removeKey(key);
      throw error;
    }
  }

  private async releaseInventory(orderId: string, logger: Logger) {
    await this.delay(800);
    logger.debug(`Inventory released`);
  }

  private async processRefund(orderId: string, logger: Logger) {
    await this.delay(2000);
    logger.debug(`Refund processed`);
  }

  private async notifyCustomerCancellation(
    customerId: string,
    orderId: string,
    logger: Logger,
  ) {
    await this.delay(300);
    logger.debug(`Customer notified`);
  }
}
