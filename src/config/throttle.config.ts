import { ConfigService } from '@nestjs/config';
import { ThrottlerModuleOptions } from '@nestjs/throttler';

const DEFAULT_THROTTLE_GLOBAL_TTL = 60 * 1000; // 1 minute
const DEFAULT_THROTTLE_GLOBAL_LIMIT = 60;
const DEFAULT_THROTTLE_LIMIT = 10;
const TEST_THROTTLE_LIMIT = 10000; // High limit for tests to avoid throttling

export const resolveThrottleLimit = (limit?: number): number => {
  if (process.env.TEST_ENV === 'true') {
    return TEST_THROTTLE_LIMIT;
  }
  if (limit && limit > 0) {
    return limit;
  }
  return DEFAULT_THROTTLE_LIMIT;
};

export const throttleConfig = (
  configService: ConfigService,
): ThrottlerModuleOptions => ({
  throttlers: [
    {
      ttl: DEFAULT_THROTTLE_GLOBAL_TTL,
      limit: DEFAULT_THROTTLE_GLOBAL_LIMIT,
    },
  ],
  skipIf: () => {
    // Skip throttling for tests
    return configService.get('TEST_ENV') === 'true';
  },
});
