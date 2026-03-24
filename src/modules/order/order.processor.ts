import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { JobHandlerFactory } from './factories/job-handler.factory';
import { JobQueue } from '../common/enums/job-queue.enum';

import { CacheService } from '../cache/cache.service';

@Processor(JobQueue.ORDER_FLOW)
export class OrderProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderProcessor.name);

  constructor(
    private readonly factory: JobHandlerFactory,
    private readonly cacheService: CacheService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const lockKey = `lock:job:${job.id}`;

    const lock = await this.cacheService.setIfNotExists(lockKey, '1', 30);
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

      await handler.execute(job, this.logger);
    } finally {
      await this.cacheService.delete(lockKey);
    }
  }
}
