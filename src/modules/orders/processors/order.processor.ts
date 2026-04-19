import { OnWorkerEvent, Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { OrderJobHandlerFactory } from '../factories/order-job-handler.factory';
import { CACHE_SERVICE } from '../../../shared/modules/cache/constants/cache.token';
import type { ICacheService } from '../../../shared/modules/cache/interfaces/cache-service.interface';
import { BaseProcessor } from '@/shared/processors/base.processor';
import { ConfigService } from '@nestjs/config';
import { ORDER_KEY } from '../../../shared/modules/cache/constants/order.key';
import { ORDER_QUEUE } from '@/shared/constants/queues.token';
import { Injectable, Inject } from '@nestjs/common';
import { DbGuardService } from '@/shared/modules/db-guard/db-guard.service';

@Injectable()
@Processor(ORDER_QUEUE, { maxStalledCount: 1 })
export class OrderProcessor extends BaseProcessor {
  constructor(
    private readonly factory: OrderJobHandlerFactory,
    @Inject(CACHE_SERVICE) cacheService: ICacheService,
    configService: ConfigService,
    guard: DbGuardService,
  ) {
    super(OrderProcessor.name, cacheService, configService, guard);
  }

  // Main method
  async process(job: Job) {
    await this.executeJob(
      job,
      'process',
      this.factory,
      ORDER_KEY.IDEMPOTENCY('job', job.id),
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
        ORDER_KEY.IDEMPOTENCY('job', job.id),
        error,
      );
    }
  }

  get concurrencyMultiplier(): number {
    return 4;
  }

  get concurrency(): number {
    return Number(this.configService.get<string>('QUEUE_ORDER_CONCURRENCY')) || 15;
  }
}
