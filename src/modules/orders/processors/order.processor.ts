import { OnWorkerEvent, Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { OrderJobHandlerFactory } from '../factories/order-job-handler.factory';

import { CacheService } from '../../cache/cache.service';
import { BaseProcessor } from '@/shared/processors/base.processor';
import { RequestContext } from '@/shared/utils/request-context';
import { randomUUID } from 'crypto';
import { OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UseLock } from '@/shared/decorators/lock.decorator';
import Redlock from 'redlock';

@Processor('orders', { maxStalledCount: 1 })
export class OrderProcessor extends BaseProcessor implements OnApplicationBootstrap {
  constructor(
    protected readonly factory: OrderJobHandlerFactory,
    protected readonly cacheService: CacheService,
    protected readonly configService: ConfigService,
    protected readonly redlock: Redlock, // Used in @UseLock()
  ) {
    super(OrderProcessor.name);
  }

  onApplicationBootstrap() {
    const concurrency = this.configService.get<string>('QUEUE_ORDER_CONCURRENCY');
    this.setupConcurrency(Number(concurrency));
  }

  async process(job: Job) {
    await this.execute(job, 'process');
  }

  @OnWorkerEvent('failed')
  async onJobFailed(job: Job, error: Error) {
    if (job.attemptsMade >= (job.opts.attempts || 1)) {
      // Execute after all retries have been exhausted
      await this.execute(job, 'failed', error);
    }
  }

  @UseLock({ prefix: 'job-execute', key: ([job]) => job.id })
  async execute(job: Job, event: 'process' | 'failed', error?: Error) {
    const correlationId = job.data?.correlationId ?? randomUUID();

    return RequestContext.run(correlationId, async () => {
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
    });
  }

  getConcurrencyMultiplier(): number {
    return 4;
  }
}
