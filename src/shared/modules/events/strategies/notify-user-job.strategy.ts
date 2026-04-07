import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { CacheService } from '../../cache/cache.service';
import { delay } from '../../../helpers/functions';
import { NotifyUserJobPayload } from '../processors/payloads/event-job.payload';
import { Transactional } from '@/shared/decorators/transactional.decorator';
import { BaseJobStrategy } from '@/shared/strategies/base-job.strategy';

@Injectable()
export class NotifyUserJobStrategy extends BaseJobStrategy<NotifyUserJobPayload> {
  constructor(protected readonly cacheService: CacheService) {
    super(NotifyUserJobStrategy.name);
  }

  async execute(job: Job<NotifyUserJobPayload>): Promise<void> {
    const { userId, message } = job.data;

    await this.notifyUser(userId, message);
  }

  @Transactional()
  async executeAfterFail(
    job: Job<NotifyUserJobPayload>,
    error: Error,
  ): Promise<void> {
    const { userId } = job.data;

    this.logger.error(
      `Failed to notify user ${userId} after all retries: ${error.message}`,
    );
  }

  private async notifyUser(userId: string, message: string) {
    await delay(1000);

    this.logger.log(`Notification sent to user ${userId}:`);

    this.logger.log(message);
  }
}
