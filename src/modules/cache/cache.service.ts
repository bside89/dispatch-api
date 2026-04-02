import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleDestroy {
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

  async setIfNotExists<T>(
    key: string,
    value: T,
    ttl?: number,
  ): Promise<boolean> {
    const existing = await this.cacheManager.get<T>(key);
    if (existing) return false;
    await this.cacheManager.set(key, value, ttl);
    return true;
  }

  async delete(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }

  async onModuleDestroy(): Promise<void> {
    await this.redisClient.quit();
  }

  async deletePattern(listCacheKey: string): Promise<void> {
    const keys: string[] = await this.redisClient.keys(listCacheKey);
    if (keys.length > 0) {
      await this.redisClient.del(...keys);
    }
  }
}
