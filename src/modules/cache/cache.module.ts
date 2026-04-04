import { Module } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import Redlock from 'redlock';
import { redisConfig } from '../../config/redis.config';
import { CacheService } from './cache.service';
import { REDIS_CLIENT } from '@/shared/constants/redis-client.constant';

@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: redisConfig,
      inject: [ConfigService],
    }),
  ],
  providers: [
    CacheService,
    {
      provide: REDIS_CLIENT,
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get('REDIS_URL');
        if (redisUrl) {
          return new Redis(redisUrl);
        }

        return new Redis({
          host: configService.get('REDIS_HOST') || 'localhost',
          port: configService.get('REDIS_PORT') || 6379,
          password: configService.get('REDIS_PASSWORD') || undefined,
        });
      },
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
