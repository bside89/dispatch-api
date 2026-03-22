import { ConfigService } from '@nestjs/config';
import { BullRootModuleOptions } from '@nestjs/bullmq';

export const bullmqConfig = (
  configService: ConfigService,
): BullRootModuleOptions => ({
  connection: {
    host: configService.get('REDIS_HOST') || 'localhost',
    port: configService.get('REDIS_PORT') || 6379,
    password: configService.get('REDIS_PASSWORD') || undefined,
  },
});
