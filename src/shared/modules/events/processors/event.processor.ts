import { OnWorkerEvent, Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { NotificationStrategy } from '../strategies/notification.strategy';
import { BaseProcessor } from '@/shared/processors/base.processor';
import { OutboxType as JobName } from '@/shared/modules/outbox/enums/outbox-type.enum';
import { RequestContext } from '@/shared/utils/request-context';
import { randomUUID } from 'crypto';
import { OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_CONFIG } from '@/shared/constants/cache.constant';
import { CacheService } from '@/modules/cache/cache.service';

@Processor('events', { maxStalledCount: 1 })
export class EventProcessor
  extends BaseProcessor
  implements OnApplicationBootstrap
{
  constructor(
    protected readonly notificationStrategy: NotificationStrategy,
    protected readonly configService: ConfigService,
    protected readonly cacheService: CacheService,
  ) {
    super(cacheService, EventProcessor.name);
  }

  onApplicationBootstrap() {
    const concurrency = this.configService.get<string>(
      'QUEUE_EVENT_CONCURRENCY',
    );
    this.setupConcurrency(Number(concurrency));
  }

  async process(job: Job) {
    await this.execute('process', job);
  }

  @OnWorkerEvent('failed')
  async onJobFailed(job: Job, error: Error) {
    if (job.attemptsMade >= (job.opts.attempts || 1)) {
      // Execute after all retries have been exhausted
      await this.execute('failed', job, error);
    }
  }

  async execute(event: 'process' | 'failed', job: Job, error?: Error) {
    const correlationId = job.data?.correlationId ?? randomUUID();

    return RequestContext.run(correlationId, async () => {
      const lockKey = `lock:job:${job.id}`;

      const lock = await this.cacheService.setIfNotExists(
        lockKey,
        '1',
        CACHE_CONFIG.SERVICE_LOCK_TTL,
      );
      if (!lock) {
        this.logger.warn(`Job ${job.id} already running`);
        return;
      }

      try {
        switch (job.name) {
          case JobName.EVENTS_NOTIFY_USER:
            if (event === 'process') {
              return this.notificationStrategy.execute(job);
            } else {
              return this.notificationStrategy.executeOnFailed(job, error);
            }
        }
      } finally {
        await this.cacheService.delete(lockKey);
      }
    });
  }

  getConcurrencyMultiplier(): number {
    return 2;
  }
}
