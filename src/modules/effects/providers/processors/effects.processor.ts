import { EFFECTS_QUEUE } from '@/shared/constants/queues.token';
import { CACHE_SERVICE } from '@/shared/modules/cache/constants/cache.token';
import type { ICacheService } from '@/shared/modules/cache/interfaces/cache-service.interface';
import { DbGuardService } from '@/shared/modules/db-guard/db-guard.service';
import { BaseProcessor } from '@/shared/providers/processors/base.processor';
import { OnWorkerEvent, Processor } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { EFFECT_KEY } from '../../constants/effects.key';
import { EffectJobHandlerFactory } from '../factories/effects-job-handler.factory';

@Injectable()
@Processor(EFFECTS_QUEUE, { maxStalledCount: 1 })
export class EffectsProcessor extends BaseProcessor {
  constructor(
    protected readonly factory: EffectJobHandlerFactory,
    @Inject(CACHE_SERVICE) cacheService: ICacheService,
    configService: ConfigService,
    guard: DbGuardService,
  ) {
    super(EffectsProcessor.name, cacheService, configService, guard);
  }

  // Main method
  async process(job: Job): Promise<void> {
    await this.executeProcessJob(job, this.factory, EFFECT_KEY.IDEMPOTENCY(job.id));
  }

  @OnWorkerEvent('failed')
  async processFailed(job: Job, error: Error): Promise<void> {
    if (job.attemptsMade >= (job.opts.attempts || 1)) {
      // Execute after all retries have been exhausted
      await this.executeFailedJob(
        job,
        this.factory,
        EFFECT_KEY.IDEMPOTENCY(job.id),
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
