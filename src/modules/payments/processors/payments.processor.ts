import { Injectable } from '@nestjs/common';
import { OnWorkerEvent, Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BaseProcessor } from '@/shared/processors/base.processor';
import { PAYMENT_QUEUE_TOKEN } from '@/shared/constants/queue-tokens';
import { PAYMENT_KEY } from '../../../shared/modules/cache/constants/payment.key';
import Redlock from 'redlock';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '@/shared/modules/cache/cache.service';
import { PaymentJobHandlerFactory } from '../factories/payment-job-handler.factory';

@Injectable()
@Processor(PAYMENT_QUEUE_TOKEN, { maxStalledCount: 1 })
export class PaymentsProcessor extends BaseProcessor {
  constructor(
    private readonly factory: PaymentJobHandlerFactory,
    cacheService: CacheService,
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
