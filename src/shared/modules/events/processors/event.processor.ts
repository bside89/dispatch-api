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
import { UseLock } from '@/shared/decorators/lock.decorator';
import Redlock from 'redlock';

@Processor('events', { maxStalledCount: 1 })
export class EventProcessor extends BaseProcessor implements OnApplicationBootstrap {
  constructor(
    protected readonly notificationStrategy: NotificationStrategy,
    protected readonly configService: ConfigService,
    protected readonly cacheService: CacheService,
    protected readonly redlock: Redlock, // Used in @UseLock()
  ) {
    super(EventProcessor.name);
  }

  onApplicationBootstrap() {
    const concurrency = this.configService.get<string>('QUEUE_EVENT_CONCURRENCY');
    this.setupConcurrency(Number(concurrency));
  }

  async process(job: Job) {
    await this.execute(job, 'process');
  }

  @OnWorkerEvent('failed')
  async onJobFailed(job: Job, error: Error) {
    if (job.attemptsMade >= (job.opts.attempts || 1)) {
      // Execute after all retries have been exhausted
      await this.execute(job, 'failed', error);
    }
  }

  @UseLock({ prefix: 'job-execute', key: ([job]) => job.id })
  async execute(job: Job, event: 'process' | 'failed', error?: Error) {
    const correlationId = job.data?.correlationId ?? randomUUID();

    return RequestContext.run(correlationId, async () => {
      switch (job.name) {
        case JobName.EVENTS_NOTIFY_USER:
          if (event === 'process') {
            await this.notificationStrategy.execute(job);
          } else {
            await this.notificationStrategy.executeOnFailed(job, error);
          }
      }
    });
  }

  getConcurrencyMultiplier(): number {
    return 2;
  }
}
