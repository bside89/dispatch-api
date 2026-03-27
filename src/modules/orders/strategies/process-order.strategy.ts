import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { BaseOrderJobStrategy } from './base-order-job.strategy';
import { OrderStatus } from '../enums/order-status.enum';
import { OrderJob } from '../enums/order-job.enum';
import { ProcessOrderJobData, ShipOrderJobData } from '../misc/order-job-data';
import { NotifyUserJobData } from '../../events/misc/events-job-data';
import { delay } from '../../../shared/helpers/functions';

@Injectable()
export class ProcessOrderStrategy extends BaseOrderJobStrategy<ProcessOrderJobData> {
  async execute(job: Job<ProcessOrderJobData>, logger: Logger): Promise<void> {
    const { userId, orderId } = job.data;

    // Idempotency check
    const key = `idempotency:order:process:${orderId}`;
    if (await this.hasKey(key)) return;
    await this.setKey(key);

    if (await this.isAlreadyInStatus(orderId, OrderStatus.PROCESSED)) {
      logger.log(`Order ${orderId} is already in PROCESSING status`);
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

      // Send notification to the event bus
      await this.eventBus.publish(
        new NotifyUserJobData(
          userId,
          `TO CUSTOMER: Your order with id ${orderId} has been processed successfully!`,
        ),
      );

      // Trigger shipping job after processing
      await this.orderQueue.add(
        OrderJob.SHIP_ORDER,
        new ShipOrderJobData(userId, orderId),
      );

      logger.log(`Order ${orderId} moved to PROCESSING`);
    } catch (error) {
      await this.removeKey(key);
      throw error;
    }
  }

  private async validateOrder(data: ProcessOrderJobData, logger: Logger) {
    await delay(1000);
    if (data.total <= 0) throw new Error('Invalid order total');
    logger.log(`Validation OK`);
  }

  private async processPayment(data: ProcessOrderJobData, logger: Logger) {
    await delay(2000);
    logger.log(`Payment OK`);
  }

  private async reserveInventory(data: ProcessOrderJobData, logger: Logger) {
    await delay(1500);
    logger.log(`Inventory OK`);
  }
}
