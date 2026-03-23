import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';
import Redis from 'ioredis';

@Injectable()
export class CacheService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @Inject('REDIS_CLIENT') private redisClient: Redis,
  ) {}

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
}
