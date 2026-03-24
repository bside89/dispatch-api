import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { BaseJobStrategy } from './job-processing.strategy';
import { OrderProcessJob } from '../interfaces/order-process-job.interfaces';
import { OrderStatus } from '../enums/order-status.enum';

@Injectable()
export class ProcessOrderStrategy extends BaseJobStrategy<OrderProcessJob> {
  async execute(job: Job<OrderProcessJob>, logger: Logger): Promise<void> {
    const { orderId } = job.data;

    const key = `idempotency:order:process:${orderId}`;

    // Idempotency check
    if (await this.hasKey(key)) return;

    if (await this.isAlreadyInStatus(orderId, OrderStatus.PROCESSING)) return;

    await this.setKey(key);

    logger.log(`Processing order ${orderId}`);

    try {
      await this.validateOrder(job.data, logger);
      await this.processPayment(job.data, logger);
      await this.reserveInventory(job.data, logger);

      await this.orderRepository.update(orderId, {
        status: OrderStatus.PROCESSING,
      });

      await this.notifyCustomer(job.data, logger);

      logger.log(`Order ${orderId} moved to PROCESSING`);
    } catch (error) {
      await this.removeKey(key);
      throw error;
    }
  }

  private async validateOrder(data: OrderProcessJob, logger: Logger) {
    await this.delay(1000);
    if (data.total <= 0) throw new Error('Invalid order total');
    logger.debug(`Validation OK`);
  }

  private async processPayment(data: OrderProcessJob, logger: Logger) {
    await this.delay(2000);
    logger.debug(`Payment OK`);
  }

  private async reserveInventory(data: OrderProcessJob, logger: Logger) {
    await this.delay(1500);
    logger.debug(`Inventory OK`);
  }

  private async notifyCustomer(data: OrderProcessJob, logger: Logger) {
    await this.delay(500);
    logger.debug(`Customer notified`);
  }
}
