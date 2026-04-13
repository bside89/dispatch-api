/*eslint-disable @typescript-eslint/no-explicit-any */
import { Global, Module } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import Redlock from 'redlock';
import { cacheConfig, redisClient } from '../../../config/redis.config';
import { CacheService } from './cache.service';
import { REDIS_CLIENT } from '@/shared/modules/cache/constants/redis-client.constant';

@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: cacheConfig,
      inject: [ConfigService],
    }),
  ],
  providers: [
    CacheService,
    {
      provide: REDIS_CLIENT,
      useFactory: redisClient,
      inject: [ConfigService],
    },
    {
      provide: Redlock,
      useFactory: (redis: Redis) => new Redlock([redis] as any),
      inject: [REDIS_CLIENT],
    },
  ],
  exports: [CacheService, REDIS_CLIENT, Redlock],
})
export class CacheModule {}
