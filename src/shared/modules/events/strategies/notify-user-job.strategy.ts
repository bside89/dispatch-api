import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { delay } from '../../../helpers/functions';
import { NotifyUserJobPayload } from '../../../payloads/event-job.payload';
import { BaseEventJobStrategy } from './base-event-job.strategy';

@Injectable()
export class NotifyUserJobStrategy extends BaseEventJobStrategy<NotifyUserJobPayload> {
  constructor() {
    super(NotifyUserJobStrategy.name);
  }

  async execute(job: Job<NotifyUserJobPayload>): Promise<void> {
    await this.notifyUser(job.data);
  }

  async executeAfterFail(
    job: Job<NotifyUserJobPayload>,
    error: Error,
  ): Promise<void> {
    const { userId } = job.data;

    this.logger.error(
      `Failed to notify user ${userId} after all retries: ${error.message}`,
    );
  }

  private async notifyUser(payload: NotifyUserJobPayload) {
    const { userId, message } = payload;
    // TODO: Add real notification logic (e.g., send email, push notification, etc.)
    await delay(1000);

    this.logger.log(`Notification sent to user ${userId}:`);
    this.logger.log(message);
  }
}
