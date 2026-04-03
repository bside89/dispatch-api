import { CacheService } from '@/modules/cache/cache.service';
import { CACHE_CONFIG } from '@/shared/constants/cache.constant';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

export abstract class BaseJobStrategy<T = any> {
  protected readonly logger: Logger;

  constructor(
    protected readonly cacheService: CacheService,
    protected readonly jobName: string,
  ) {
    this.logger = new Logger(jobName);
  }

  async getIdempotency(key: string): Promise<string | null> {
    return this.cacheService.get<string>(key);
  }

  async setIdempotency(key: string, status: string): Promise<void> {
    await this.cacheService.set(key, status, CACHE_CONFIG.IDEMPOTENCY_TTL);
  }

  abstract execute(job: Job<T>): Promise<void>;

  abstract executeOnFailed(job: Job<T>, error: Error): Promise<void>;
}
