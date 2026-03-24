import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { BaseJobStrategy } from './job-processing.strategy';
import { ProcessOrderJob } from '../interfaces/process-order-job.interfaces';
import { OrderStatus } from '../enums/order-status.enum';
import { OrderJob } from '../enums/order-job.enum';

@Injectable()
export class ProcessOrderStrategy extends BaseJobStrategy<ProcessOrderJob> {
  async execute(job: Job<ProcessOrderJob>, logger: Logger): Promise<void> {
    const { orderId } = job.data;

    // Idempotency check
    const key = `idempotency:order:process:${orderId}`;
    if (await this.hasKey(key)) return;
    await this.setKey(key);

    if (await this.isAlreadyInStatus(orderId, OrderStatus.PROCESSED)) {
      logger.debug(`Order ${orderId} is already in PROCESSING status`);
      return;
    }

    logger.log(`Processing order ${orderId}`);

    try {
      await this.validateOrder(job.data, logger);
      await this.processPayment(job.data, logger);
      await this.reserveInventory(job.data, logger);

      await this.orderRepository.update(orderId, {
        status: OrderStatus.PROCESSED,
      });

      // Send notification to the queue
      await this.notifyCustomer(OrderStatus.PROCESSED, orderId);

      // Trigger shipping job after processing
      await this.orderQueue.add(
        OrderJob.SHIP_ORDER,
        { orderId },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        },
      );

      logger.log(`Order ${orderId} moved to PROCESSING`);
    } catch (error) {
      await this.removeKey(key);
      throw error;
    }
  }

  private async validateOrder(data: ProcessOrderJob, logger: Logger) {
    await this.delay(1000);
    if (data.total <= 0) throw new Error('Invalid order total');
    logger.debug(`Validation OK`);
  }

  private async processPayment(data: ProcessOrderJob, logger: Logger) {
    await this.delay(2000);
    logger.debug(`Payment OK`);
  }

  private async reserveInventory(data: ProcessOrderJob, logger: Logger) {
    await this.delay(1500);
    logger.debug(`Inventory OK`);
  }
}
