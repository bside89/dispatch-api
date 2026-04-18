import { REDIS_CLIENT } from '@/shared/modules/cache/constants/redis-client.constant';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import Redis from 'ioredis';
import { ICacheService } from './interfaces/cache-service.interface';

@Injectable()
export class CacheService implements OnModuleDestroy, ICacheService {
  constructor(
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    @Inject(REDIS_CLIENT)
    private readonly redisClient: Redis, // Used for delete in batch with pattern
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.cacheManager.disconnect();
    await this.redisClient.quit();
  }

  async get<T>(key: string): Promise<T | undefined> {
    return await this.cacheManager.get<T>(key);
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    await this.cacheManager.set(key, value, ttl);
  }

  async delete(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }

  async deletePattern(listCacheKey: string): Promise<void> {
    const keys: string[] = await this.redisClient.keys(listCacheKey);
    if (keys.length > 0) {
      await this.redisClient.del(...keys);
    }
  }

  /**
   * Deletes cache entries based on the provided options.
   * @param options Object containing keys and patterns to delete from the cache.
   */
  async deleteBulk(options: {
    keys?: string[];
    patterns?: string[];
  }): Promise<void> {
    const keysToDelete: string[] = options.keys || [];
    const patternsToDelete: string[] = options.patterns || [];

    await Promise.all([
      // Delete specific keys
      ...keysToDelete.map((key) => this.delete(key)),
      // Delete pattern-based keys
      ...patternsToDelete.map((pattern) => this.deletePattern(pattern)),
    ]);
  }
}
