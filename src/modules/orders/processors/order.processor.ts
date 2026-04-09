import { OnWorkerEvent, Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { OrderJobHandlerFactory } from '../factories/order-job-handler.factory';
import { CacheService } from '../../../shared/modules/cache/cache.service';
import { BaseProcessor } from '@/shared/processors/base.processor';
import { ConfigService } from '@nestjs/config';
import Redlock from 'redlock';
import { ORDER_KEY } from '../../../shared/modules/cache/constants/order.key';
import { ORDER_QUEUE_TOKEN } from '@/shared/constants/queue-tokens';

@Processor(ORDER_QUEUE_TOKEN, { maxStalledCount: 1 })
export class OrderProcessor extends BaseProcessor {
  constructor(
    private readonly factory: OrderJobHandlerFactory,
    protected readonly configService: ConfigService,
    protected readonly cacheService: CacheService,
    protected readonly redlock: Redlock, // Used in @UseLock()
  ) {
    super(OrderProcessor.name, cacheService, configService, redlock);
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
}
