import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CacheService } from '../../cache/cache.service';
import { delay } from '../../../shared/helpers/functions';
import { CACHE_CONFIG } from '@/shared/constants/cache.constant';

@Injectable()
export class NotificationStrategy {
  constructor(private readonly cacheService: CacheService) {}

  async execute(job: Job, logger: Logger): Promise<void> {
    const { jobId, userId, message } = job.data;

    const key = `idempotency:event:${jobId}`;

    if (await this.cacheService.get(key)) return;
    await this.cacheService.set(key, '1', CACHE_CONFIG.JOB_STRATEGY_TTL);

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

    logger.log(`Notification sent to user ${userId}:`);

    logger.log(message);
  }
}
