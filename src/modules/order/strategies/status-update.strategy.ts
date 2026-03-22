import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { BaseJobStrategy } from './job-processing.strategy';
import { StatusUpdateJob } from '../interfaces/status-update-job.interfaces';
import { StatusActionFactory } from '../factories/status-action.factory';

export class StatusUpdateStrategy extends BaseJobStrategy<StatusUpdateJob> {
  async execute(job: Job<StatusUpdateJob>, logger: Logger): Promise<void> {
    const { orderId, oldStatus, newStatus } = job.data;

    logger.log(
      `Order ${orderId} status updated from ${oldStatus} to ${newStatus}`,
    );

    try {
      await this.sendStatusNotification(job.data, logger);

      // Use Status Action Factory to get appropriate action
      const statusAction = StatusActionFactory.createAction(newStatus);
      if (statusAction) {
        await statusAction.execute(orderId, logger);
      }

      logger.log(`Successfully handled status update for order ${orderId}`);
    } catch (error) {
      logger.error(
        `Failed to handle status update for order ${orderId}:`,
        error.message,
      );
      throw error;
    }
  }

  private async sendStatusNotification(
    statusData: StatusUpdateJob,
    logger: Logger,
  ): Promise<void> {
    await this.delay(300);

    logger.debug(`Status notification sent for order ${statusData.orderId}`);
  }
}
