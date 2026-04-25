import { ConfigService } from '@nestjs/config';

const DEFAULT_THROTTLE_LIMIT = 60;
export const TEST_THROTTLE_LIMIT = 999999;

export const resolveThrottleLimit = (limit: number) =>
  process.env.TEST_ENV === 'true' ? TEST_THROTTLE_LIMIT : limit;

export const throttleConfig = (configService: ConfigService) => ({
  throttlers: [
    {
      ttl: 60 * 1000, // 1 minute
      // If TEST_ENV is true, set a very high limit to effectively disable throttling during tests.
      limit:
        configService.get('TEST_ENV') === 'true'
          ? TEST_THROTTLE_LIMIT
          : DEFAULT_THROTTLE_LIMIT,
    },
  ],
});
