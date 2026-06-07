import { USER_QUEUE } from '@/shared/constants/queues.token';
import { CACHE_SERVICE } from '@/shared/modules/cache/constants/cache.token';
import { USER_KEY } from '@/shared/modules/cache/constants/user.key';
import type { ICacheService } from '@/shared/modules/cache/interfaces/cache-service.interface';
import { DbGuardService } from '@/shared/modules/db-guard/db-guard.service';
import { BaseProcessor } from '@/shared/processors/base.processor';
import { OnWorkerEvent, Processor } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { UserJobHandlerFactory } from '../factories/user-job-handler.factory';

@Injectable()
@Processor(USER_QUEUE, { maxStalledCount: 1 })
export class UsersProcessor extends BaseProcessor {
  constructor(
    private readonly factory: UserJobHandlerFactory,
    @Inject(CACHE_SERVICE) cacheService: ICacheService,
    configService: ConfigService,
    guard: DbGuardService,
  ) {
    super(UsersProcessor.name, cacheService, configService, guard);
  }

  async process(job: Job): Promise<void> {
    await this.executeProcessJob(
      job,
      this.factory,
      USER_KEY.IDEMPOTENCY('job', job.id),
    );
  }

  @OnWorkerEvent('failed')
  async processFailed(job: Job, error: Error): Promise<void> {
    if (job.attemptsMade >= (job.opts.attempts || 1)) {
      await this.executeFailedJob(
        job,
        this.factory,
        USER_KEY.IDEMPOTENCY('job', job.id),
        error,
      );
    }
  }

  get concurrencyMultiplier(): number {
    return 4;
  }

  get concurrency(): number {
    return Number(this.configService.get<string>('QUEUE_USER_CONCURRENCY')) || 15;
  }
}
