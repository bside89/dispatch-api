import { OnWorkerEvent, Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BaseProcessor } from '@/shared/processors/base.processor';
import { ConfigService } from '@nestjs/config';
import { CACHE_SERVICE } from '@/shared/modules/cache/constants/cache.token';
import type { ICacheService } from '@/shared/modules/cache/interfaces/cache-service.interface';
import Redlock from 'redlock';
import { EventJobHandlerFactory } from '../factories/event-job-handler.factory';
import { EVENT_KEY } from '../constants/event.key';
import { EVENT_QUEUE } from '@/shared/constants/queue-names.constant';
import { Injectable, Inject } from '@nestjs/common';

@Injectable()
@Processor(EVENT_QUEUE, { maxStalledCount: 1 })
export class EventProcessor extends BaseProcessor {
  constructor(
    protected readonly factory: EventJobHandlerFactory,
    @Inject(CACHE_SERVICE) cacheService: ICacheService,
    configService: ConfigService,
    redlock: Redlock,
  ) {
    super(EventProcessor.name, cacheService, configService, redlock);
  }

  // Main method
  async process(job: Job) {
    await this.executeJob(
      job,
      'process',
      this.factory,
      EVENT_KEY.IDEMPOTENCY(job.id),
    );
  }

  @OnWorkerEvent('failed')
  async processFailed(job: Job, error: Error) {
    if (job.attemptsMade >= (job.opts.attempts || 1)) {
      // Execute after all retries have been exhausted
      await this.executeJob(
        job,
        'failed',
        this.factory,
        EVENT_KEY.IDEMPOTENCY(job.id),
        error,
      );
    }
  }

  get concurrencyMultiplier(): number {
    return 2;
  }

  get concurrency(): number {
    return Number(this.configService.get<string>('QUEUE_EVENT_CONCURRENCY')) || 30;
  }
}
