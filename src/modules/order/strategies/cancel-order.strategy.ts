import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { BaseJobStrategy } from './job-processing.strategy';
import { CancelOrderJob } from '../interfaces/cancel-order-job.interfaces';

export class CancelOrderStrategy extends BaseJobStrategy<CancelOrderJob> {
  async execute(job: Job<CancelOrderJob>, logger: Logger): Promise<void> {
    const { orderId, customerId } = job.data;

    logger.log(`Processing cancellation for order ${orderId}`);

    try {
      await this.releaseInventory(orderId, logger);
      await this.processRefund(orderId, logger);
      await this.notifyCustomerCancellation(customerId, orderId, logger);

      logger.log(`Successfully processed cancellation for order ${orderId}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        `Failed to process cancellation for order ${orderId}: ${errorMessage}`,
      );
      throw error;
    }
  }

  private async releaseInventory(
    orderId: string,
    logger: Logger,
  ): Promise<void> {
    await this.delay(800);

    logger.debug(`Inventory released for order ${orderId}`);
  }

  private async processRefund(orderId: string, logger: Logger): Promise<void> {
    await this.delay(2000);

    logger.debug(`Refund processed for order ${orderId}`);
  }

  private async notifyCustomerCancellation(
    customerId: string,
    orderId: string,
    logger: Logger,
  ): Promise<void> {
    await this.delay(300);

    logger.debug(
      `Customer ${customerId} notified about order ${orderId} cancellation`,
    );
  }
}
