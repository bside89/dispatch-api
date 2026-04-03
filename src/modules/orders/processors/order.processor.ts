import { OnWorkerEvent, Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { OrderJobHandlerFactory } from '../factories/order-job-handler.factory';

import { CacheService } from '../../cache/cache.service';
import { BaseProcessor } from '@/shared/processors/base.processor';
import { CACHE_CONFIG } from '@/shared/constants/cache.constant';
import { RequestContext } from '@/shared/utils/request-context';
import { randomUUID } from 'crypto';
import { OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Processor('orders', { maxStalledCount: 1 })
export class OrderProcessor
  extends BaseProcessor
  implements OnApplicationBootstrap
{
  constructor(
    protected readonly factory: OrderJobHandlerFactory,
    protected readonly cacheService: CacheService,
    protected readonly configService: ConfigService,
  ) {
    super(cacheService, OrderProcessor.name);
  }

  onApplicationBootstrap() {
    const concurrency = this.configService.get<string>(
      'QUEUE_ORDER_CONCURRENCY',
    );
    this.setupConcurrency(Number(concurrency));
  }

  async process(job: Job) {
    await this.execute('process', job);
  }

  @OnWorkerEvent('failed')
  async onJobFailed(job: Job, error: Error) {
    if (job.attemptsMade >= (job.opts.attempts || 1)) {
      // Execute after all retries have been exhausted
      await this.execute('failed', job, error);
    }
  }

  async execute(event: 'process' | 'failed', job: Job, error?: Error) {
    const correlationId = job.data?.correlationId ?? randomUUID();

    return RequestContext.run(correlationId, async () => {
      const lockKey = `lock:job:${job.id}`;

      const lock = await this.cacheService.setIfNotExists(
        lockKey,
        '1',
        CACHE_CONFIG.SERVICE_LOCK_TTL,
      );
      if (!lock) {
        this.logger.warn(`Job ${job.id} already running`);
        return;
      }

      try {
        const handler = this.factory.createHandler(job.name);

        if (!handler) {
          this.logger.warn(`Unknown job: ${job.name}`);
          return;
        }

        if (event === 'failed') {
          await handler.executeOnFailed(job, error!);
        } else {
          await handler.execute(job);
        }
      } finally {
        await this.cacheService.delete(lockKey);
      }
    });
  }

  getConcurrencyMultiplier(): number {
    return 4;
  }
}
