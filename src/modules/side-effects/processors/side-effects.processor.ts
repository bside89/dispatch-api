import { OnWorkerEvent, Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BaseProcessor } from '@/shared/processors/base.processor';
import { ConfigService } from '@nestjs/config';
import { CACHE_SERVICE } from '@/shared/modules/cache/constants/cache.token';
import type { ICacheService } from '@/shared/modules/cache/interfaces/cache-service.interface';
import { SideEffectJobHandlerFactory } from '../factories/side-effects-job-handler.factory';
import { SIDE_EFFECT_KEY } from '../constants/side-effects.key';
import { SIDE_EFFECTS_QUEUE } from '@/shared/constants/queues.token';
import { Injectable, Inject } from '@nestjs/common';
import { DbGuardService } from '@/shared/modules/db-guard/db-guard.service';

@Injectable()
@Processor(SIDE_EFFECTS_QUEUE, { maxStalledCount: 1 })
export class SideEffectsProcessor extends BaseProcessor {
  constructor(
    protected readonly factory: SideEffectJobHandlerFactory,
    @Inject(CACHE_SERVICE) cacheService: ICacheService,
    configService: ConfigService,
    guard: DbGuardService,
  ) {
    super(SideEffectsProcessor.name, cacheService, configService, guard);
  }

  // Main method
  async process(job: Job) {
    await this.executeProcessJob(
      job,
      this.factory,
      SIDE_EFFECT_KEY.IDEMPOTENCY(job.id),
    );
  }

  @OnWorkerEvent('failed')
  async processFailed(job: Job, error: Error) {
    if (job.attemptsMade >= (job.opts.attempts || 1)) {
      // Execute after all retries have been exhausted
      await this.executeFailedJob(
        job,
        this.factory,
        SIDE_EFFECT_KEY.IDEMPOTENCY(job.id),
        error,
      );
    }
  }

  get concurrencyMultiplier(): number {
    return 2;
  }

  get concurrency(): number {
    return Number(this.configService.get<string>('QUEUE_SE_CONCURRENCY')) || 30;
  }
}
