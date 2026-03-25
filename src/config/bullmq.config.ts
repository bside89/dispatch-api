import { ConfigService } from '@nestjs/config';
import { BullRootModuleOptions } from '@nestjs/bullmq';
import { DefaultJobOptions } from 'bullmq';

export const bullmqConfig = (
  configService: ConfigService,
): BullRootModuleOptions => ({
  connection: {
    host: configService.get('REDIS_HOST') || 'localhost',
    port: configService.get('REDIS_PORT') || 6379,
    password: configService.get('REDIS_PASSWORD') || undefined,
  },
});

export const bullmqDefaultJobOptions: DefaultJobOptions = {
  attempts: 3, // Retry up to 3 times on failure
  backoff: { type: 'exponential', delay: 2000 }, // Exponential backoff starting at 2s
  removeOnFail: { age: 24 * 3600 }, // Remove failed jobs after 24h
};
