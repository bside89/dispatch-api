export const CACHE_TTL = {
  DEFAULT: 5 * 60 * 1000, // 5 minutes

  LOCK: 5 * 1000, // 5 seconds

  LIST: 60 * 1000, // 1 minute

  IDEMPOTENCY: 24 * 60 * 60 * 1000, // 24 hours

  PAYMENT_IDEMPOTENCY_TTL: 24 * 60 * 60 * 1000, // 24 hours

  AUTH_BLACKLIST: 15 * 60 * 1000, // 15 minutes

  JOB_LOCK: 30 * 1000, // 30 seconds

  JOB_STRATEGY: 60 * 60 * 1000, // 1 hour
} as const;
