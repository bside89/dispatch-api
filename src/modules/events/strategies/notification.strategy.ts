import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CacheService } from '../../cache/cache.service';
import { delay } from '../../../shared/helpers/functions';

@Injectable()
export class NotificationStrategy {
  constructor(private readonly cacheService: CacheService) {}

  async execute(job: Job, logger: Logger): Promise<void> {
    const { userId, notificationId, message } = job.data;

    const key = `idempotency:event:${userId}:${notificationId}`;

    if (await this.cacheService.get(key)) return;
    await this.cacheService.set(key, '1', 3600);

    try {
      await this.handleNotification(userId, message, logger);
    } catch (error) {
      await this.cacheService.delete(key);
      throw error;
    }
  }

  private async handleNotification(
    userId: string,
    message: string,
    logger: Logger,
  ) {
    await delay(1000);

    logger.debug(`Notification sent to user ${userId}:`);

    logger.debug(message);
  }
}
