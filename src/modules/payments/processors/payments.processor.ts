import { Injectable, Inject } from '@nestjs/common';
import { OnWorkerEvent, Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BaseProcessor } from '@/shared/processors/base.processor';
import { PAYMENT_QUEUE } from '@/shared/constants/queue-names.constant';
import { PAYMENT_KEY } from '../../../shared/modules/cache/constants/payment.key';
import Redlock from 'redlock';
import { ConfigService } from '@nestjs/config';
import { CACHE_SERVICE } from '@/shared/modules/cache/constants/cache.token';
import type { ICacheService } from '@/shared/modules/cache/interfaces/cache-service.interface';
import { PaymentJobHandlerFactory } from '../factories/payment-job-handler.factory';

@Injectable()
@Processor(PAYMENT_QUEUE, { maxStalledCount: 1 })
export class PaymentsProcessor extends BaseProcessor {
  constructor(
    private readonly factory: PaymentJobHandlerFactory,
    @Inject(CACHE_SERVICE) cacheService: ICacheService,
    configService: ConfigService,
    redlock: Redlock,
  ) {
    super(PaymentsProcessor.name, cacheService, configService, redlock);
  }

  // Main method
  async process(job: Job) {
    await this.executeJob(
      job,
      'process',
      this.factory,
      PAYMENT_KEY.IDEMPOTENCY('job', job.id),
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
        PAYMENT_KEY.IDEMPOTENCY('job', job.id),
        error,
      );
    }
  }

  get concurrencyMultiplier(): number {
    return 4;
  }

  get concurrency(): number {
    return Number(this.configService.get<string>('QUEUE_PAYMENT_CONCURRENCY')) || 15;
  }
}
