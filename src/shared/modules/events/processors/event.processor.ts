import { OnWorkerEvent, Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { NotifyUserJobStrategy } from '../strategies/notify-user-job.strategy';
import { BaseProcessor } from '@/shared/processors/base.processor';
import { RequestContext } from '@/shared/utils/request-context';
import { randomUUID } from 'crypto';
import { BeforeApplicationShutdown, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '@/shared/modules/cache/cache.service';
import { UseLock } from '@/shared/decorators/lock.decorator';
import Redlock from 'redlock';
import { EventJobHandlerFactory } from '../factories/event-job-handler.factory';

@Processor('events', { maxStalledCount: 1 })
export class EventProcessor
  extends BaseProcessor
  implements OnApplicationBootstrap, BeforeApplicationShutdown
{
  constructor(
    protected readonly factory: EventJobHandlerFactory,
    protected readonly notificationStrategy: NotifyUserJobStrategy,
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

  async beforeApplicationShutdown(): Promise<void> {
    await this.worker.pause(true);
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
      const handler = this.factory.createHandler(job.name);

      if (!handler) {
        this.logger.warn(`Unknown job: ${job.name}`);
        return;
      }

      if (event === 'process') {
        await handler.execute(job);
      } else {
        await handler.executeOnFailed(job, error);
      }
    });
  }

  getConcurrencyMultiplier(): number {
    return 2;
  }
}
