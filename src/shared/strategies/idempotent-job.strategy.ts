import { CacheService } from '@/shared/modules/cache/cache.service';
import { BaseJobStrategy } from './base-job.strategy';
import { CACHE_CONFIG } from '../constants/cache.constant';
import { BaseJobPayload } from '../jobs/base-job.payload';

export abstract class IdempotentJobStrategy<
  T extends BaseJobPayload,
> extends BaseJobStrategy<T> {
  constructor(
    protected readonly jobName: string,
    protected readonly cacheService: CacheService,
  ) {
    super(jobName);
  }

  async getIdempotency(key: string): Promise<string | null> {
    return this.cacheService.get<string>(key);
  }

  async setIdempotency(key: string, status: string): Promise<void> {
    await this.cacheService.set(key, status, CACHE_CONFIG.IDEMPOTENCY_TTL);
  }
}
