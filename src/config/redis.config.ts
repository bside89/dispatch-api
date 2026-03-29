import { ConfigService } from '@nestjs/config';
import { CacheModuleOptions } from '@nestjs/cache-manager';
import { createKeyv } from '@keyv/redis';
import { CACHE_CONFIG } from '@/shared/constants/cache.constant';

export const redisConfig = (
  configService: ConfigService,
): CacheModuleOptions => ({
  stores: [
    createKeyv(
      configService.get('REDIS_URL') ||
        `redis://${configService.get('REDIS_HOST') || 'localhost'}:${configService.get('REDIS_PORT') || 6379}`,
    ),
  ],
  ttl: configService.get('CACHE_TTL') || CACHE_CONFIG.DEFAULT_TTL,
  isGlobal: true,
});
