import { ConfigService } from '@nestjs/config';
import { CacheModuleOptions } from '@nestjs/cache-manager';
import { createKeyv } from '@keyv/redis';
import { CACHE_CONFIG } from '@/shared/constants/cache-config.constant';
import Redis from 'ioredis';

export const cacheConfig = (configService: ConfigService): CacheModuleOptions => ({
  stores: [
    createKeyv(
      configService.get('REDIS_URL') ||
        `redis://${configService.get('REDIS_HOST') || 'localhost'}:${configService.get('REDIS_PORT') || 6379}`,
    ),
  ],
  ttl: configService.get('CACHE_TTL') || CACHE_CONFIG.DEFAULT_TTL,
  isGlobal: true,
});

export const redisClient = (configService: ConfigService): Redis => {
  const redisUrl = configService.get('REDIS_URL');
  if (redisUrl) {
    return new Redis(redisUrl);
  }

  return new Redis({
    host: configService.get('REDIS_HOST') || 'localhost',
    port: configService.get('REDIS_PORT') || 6379,
    password: configService.get('REDIS_PASSWORD') || undefined,
  });
};
