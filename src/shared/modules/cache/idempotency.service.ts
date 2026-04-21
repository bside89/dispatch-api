import { Inject, Injectable } from '@nestjs/common';
import { CACHE_TTL } from '@/shared/constants/cache-ttl.constant';
import { AppLogger } from '@/shared/utils/app-logger';
import { CACHE_SERVICE } from './constants/cache.token';
import type { ICacheService } from './interfaces/cache-service.interface';
import type { IIdempotencyService } from './interfaces/idempotency-service.interface';

@Injectable()
export class IdempotencyService implements IIdempotencyService {
  private readonly logger = new AppLogger(IdempotencyService.name);

  constructor(@Inject(CACHE_SERVICE) private readonly cacheService: ICacheService) {}

  async getOrExecute<T>(cacheKey: string, fn: () => Promise<T>): Promise<T> {
    const cached = await this.cacheService.get<T>(cacheKey);

    if (cached !== undefined && cached !== null) {
      this.logger.debug('Returning cached idempotent result', { cacheKey });
      return cached;
    }

    const result = await fn();

    await this.cacheService.set(cacheKey, result, CACHE_TTL.IDEMPOTENCY);

    return result;
  }
}
