import { ConfigService } from '@nestjs/config';
import { CacheModuleOptions } from '@nestjs/cache-manager';
import { createKeyv } from '@keyv/redis';

export const redisConfig = (
  configService: ConfigService,
): CacheModuleOptions => ({
  stores: [
    createKeyv(
      configService.get('REDIS_URL') ||
        `redis://${configService.get('REDIS_HOST') || 'localhost'}:${configService.get('REDIS_PORT') || 6379}`,
    ),
  ],
  ttl: configService.get('CACHE_TTL') || 300 * 1000, // Default TTL of 5 minutes
  isGlobal: true,
});
