export const CACHE_CONFIG = {
  DEFAULT_TTL: 5 * 60 * 1000, // 5 minutes

  LIST_TTL: 60 * 1000, // 1 minute

  IDEMPOTENCY_TTL: 24 * 60 * 60 * 1000, // 24 hours

  AUTH_BLACKLIST_TTL: 15 * 60 * 1000, // 15 minutes

  SERVICE_LOCK_TTL: 30 * 1000, // 30 seconds

  JOB_STRATEGY_TTL: 60 * 60 * 1000, // 1 hour
} as const;
