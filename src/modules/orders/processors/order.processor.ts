import { OnWorkerEvent, Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { OrderJobHandlerFactory } from '../factories/order-job-handler.factory';

import { CacheService } from '../../../shared/modules/cache/cache.service';
import { BaseProcessor } from '@/shared/processors/base.processor';
import { RequestContext } from '@/shared/utils/request-context';
import { randomUUID } from 'crypto';
import { BeforeApplicationShutdown, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UseLock } from '@/shared/decorators/lock.decorator';
import Redlock from 'redlock';
import { ORDER_KEY } from '../constants/order.key';
import { JobStatus } from '@/shared/enums/job-status.enum';
import { ensureError } from '@/shared/helpers/functions';

@Processor('orders', { maxStalledCount: 1 })
export class OrderProcessor
  extends BaseProcessor
  implements OnApplicationBootstrap, BeforeApplicationShutdown
{
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

  async beforeApplicationShutdown(): Promise<void> {
    await this.worker.pause(true);
  }

  // Main method
  async process(job: Job) {
    await this.processByEvent(job, 'process');
  }

  @OnWorkerEvent('failed')
  async processFailed(job: Job, error: Error) {
    if (job.attemptsMade >= (job.opts.attempts || 1)) {
      // Execute after all retries have been exhausted
      await this.processByEvent(job, 'failed', error);
    }
  }

  @UseLock({ prefix: 'job-execute', key: ([job]) => job.id })
  async processByEvent(job: Job, event: 'process' | 'failed', error?: Error) {
    const correlationId = job.data?.correlationId ?? randomUUID();

    return RequestContext.run(correlationId, async () => {
      const idempotencyKey = ORDER_KEY.IDEMPOTENCY('job', job.id);

      const idempotencyValue = await this.cacheService.get(idempotencyKey);
      if (idempotencyValue && idempotencyValue !== JobStatus.FAILED) {
        return;
      }
      await this.cacheService.set(idempotencyKey, JobStatus.IN_PROGRESS);

      try {
        // Select the appropriate job strategy based on job name and event type
        const handler = this.factory.createHandler(job.name);

        if (!handler) {
          this.logger.warn(`Unknown job: ${job.name}`);
          return;
        }

        if (event === 'failed') {
          await handler.executeAfterFail(job, error!);
        } else {
          await handler.execute(job);
        }

        await this.cacheService.set(idempotencyKey, JobStatus.COMPLETED);
      } catch (e) {
        const error = ensureError(e);

        await this.cacheService.set(idempotencyKey, JobStatus.FAILED);

        this.logger.error(
          `Error executing job ${job.name} with id ${job.id}: ${error.message}`,
        );

        throw error;
      }
    });
  }

  getConcurrencyMultiplier(): number {
    return 4;
  }
}
