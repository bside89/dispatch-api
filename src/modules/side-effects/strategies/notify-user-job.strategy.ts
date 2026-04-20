import { Inject, Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { BaseSideEffectJobStrategy } from './base-side-effects-job.strategy';
import { NotifyUserJobPayload } from '@/shared/payloads/side-effects-job.payload';
import type { INotificationsService } from '@/modules/notifications/interfaces/notifications-service.interface';
import { NOTIFICATIONS_SERVICE } from '@/modules/notifications/constants/notifications.token';

@Injectable()
export class NotifyUserJobStrategy extends BaseSideEffectJobStrategy<NotifyUserJobPayload> {
  constructor(
    @Inject(NOTIFICATIONS_SERVICE)
    private readonly notificationsService: INotificationsService,
  ) {
    super(NotifyUserJobStrategy.name);
  }

  async execute(job: Job<NotifyUserJobPayload>): Promise<void> {
    const { userId } = job.data;
    try {
      await this.notifyUser(job.data);
    } catch (e: unknown) {
      // User was deleted before notification could be delivered — skip gracefully
      if (
        typeof e === 'object' &&
        e !== null &&
        (e as Record<string, unknown>)['code'] === '23503'
      ) {
        this.logger.warn(`Skipping notification: user ${userId} no longer exists.`);
        return;
      }
      throw e;
    }
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

    await this.notificationsService.create({
      userId,
      type: 'INFO',
      title: 'New Notification',
      message,
    });

    this.logger.debug(`Notification sent to user ${userId}:`);
    this.logger.debug(`Message: ${message}`);
  }
}
