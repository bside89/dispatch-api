import { ORDER_QUEUE } from '@/shared/constants/queues.token';
import { DbGuardService } from '@/shared/modules/db-guard/db-guard.service';
import { BaseProcessor } from '@/shared/processors/base.processor';
import { OnWorkerEvent, Processor } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { CACHE_SERVICE } from '../../../../shared/modules/cache/constants/cache.token';
import { ORDER_KEY } from '../../../../shared/modules/cache/constants/order.key';
import type { ICacheService } from '../../../../shared/modules/cache/interfaces/cache-service.interface';
import { OrderJobHandlerFactory } from '../factories/order-job-handler.factory';

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
  async process(job: Job): Promise<void> {
    await this.executeProcessJob(
      job,
      this.factory,
      ORDER_KEY.IDEMPOTENCY('job', job.id),
    );
  }

  @OnWorkerEvent('failed')
  async processFailed(job: Job, error: Error): Promise<void> {
    if (job.attemptsMade >= (job.opts.attempts || 1)) {
      // Execute after all retries have been exhausted
      await this.executeFailedJob(
        job,
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
