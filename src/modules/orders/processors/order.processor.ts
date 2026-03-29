import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { OrderJobHandlerFactory } from '../factories/order-job-handler.factory';

import { CacheService } from '../../cache/cache.service';
import { BaseProcessor } from '@/shared/processors/base.processor';
import { CACHE_CONFIG } from '@/shared/constants/cache.constant';

@Processor('orders')
export class OrderProcessor extends BaseProcessor {
  constructor(
    private readonly factory: OrderJobHandlerFactory,
    private readonly cacheService: CacheService,
  ) {
    super(OrderProcessor.name);
  }

  async process(job: Job): Promise<void> {
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

      await handler.execute(job, this.logger);
    } finally {
      await this.cacheService.delete(lockKey);
    }
  }
}
