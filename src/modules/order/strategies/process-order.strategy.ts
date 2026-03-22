import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { BaseJobStrategy } from './job-processing.strategy';
import { OrderProcessJob } from '../interfaces/order-process-job.interfaces';

export class ProcessOrderStrategy extends BaseJobStrategy<OrderProcessJob> {
  async execute(job: Job<OrderProcessJob>, logger: Logger): Promise<void> {
    const { orderId, customerId, total } = job.data;

    logger.log(
      `Processing order ${orderId} for customer ${customerId} with total $${total}`,
    );

    try {
      await this.validateOrder(job.data, logger);
      await this.processPayment(job.data, logger);
      await this.reserveInventory(job.data, logger);
      await this.notifyCustomer(job.data, logger);

      logger.log(`Successfully processed order ${orderId}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`Failed to process order ${orderId}: ${errorMessage}`);
      throw error;
    }
  }

  private async validateOrder(
    orderData: OrderProcessJob,
    logger: Logger,
  ): Promise<void> {
    await this.delay(1000);

    if (orderData.total <= 0) {
      throw new Error('Invalid order total');
    }

    logger.debug(`Order ${orderData.orderId} validation completed`);
  }

  private async processPayment(
    orderData: OrderProcessJob,
    logger: Logger,
  ): Promise<void> {
    await this.delay(2000);

    // Simulate random payment failure (5% chance)
    if (Math.random() < 0.05) {
      throw new Error('Payment processing failed');
    }

    logger.debug(`Payment processed for order ${orderData.orderId}`);
  }

  private async reserveInventory(
    orderData: OrderProcessJob,
    logger: Logger,
  ): Promise<void> {
    await this.delay(1500);

    // Simulate random inventory failure (3% chance)
    if (Math.random() < 0.03) {
      throw new Error('Insufficient inventory');
    }

    logger.debug(`Inventory reserved for order ${orderData.orderId}`);
  }

  private async notifyCustomer(
    orderData: OrderProcessJob,
    logger: Logger,
  ): Promise<void> {
    await this.delay(500);

    logger.debug(
      `Customer ${orderData.customerId} notified about order ${orderData.orderId}`,
    );
  }
}
