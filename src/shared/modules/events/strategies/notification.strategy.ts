import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { CacheService } from '../../../../modules/cache/cache.service';
import { delay } from '../../../helpers/functions';
import { NotifyUserJobPayload } from '../processors/payloads/notify-user.payload';
import { JobStatus } from '@/shared/enums/job-status.enum';
import { Transactional } from '@/shared/decorators/transactional.decorator';
import { IdempotentJobStrategy } from '@/shared/strategies/idempotent-job.strategy';

@Injectable()
export class NotificationStrategy extends IdempotentJobStrategy<NotifyUserJobPayload> {
  constructor(protected readonly cacheService: CacheService) {
    super(NotificationStrategy.name, cacheService);
  }

  async execute(job: Job<NotifyUserJobPayload>): Promise<void> {
    const { jobId, userId, message } = job.data;
    const idempotencyKey = this.cacheKeyIdempotency(jobId);

    const idempotencyValue = await this.getIdempotency(idempotencyKey);
    if (idempotencyValue && idempotencyValue !== JobStatus.FAILED) {
      return;
    }
    await this.setIdempotency(idempotencyKey, JobStatus.IN_PROGRESS);

    try {
      await this.notifyUser(userId, message);

      await this.setIdempotency(idempotencyKey, JobStatus.COMPLETED);
    } catch (error) {
      await this.setIdempotency(idempotencyKey, JobStatus.FAILED);

      throw error;
    }
  }

  @Transactional()
  async executeOnFailed(
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

  private cacheKeyIdempotency(jobId: string): string {
    return `idempotency:event:notification:${jobId}`;
  }
}
