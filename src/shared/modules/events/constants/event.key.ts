import { CacheKeyFactory } from '../../cache/factories/cache-key.factory';

/**
 * Centralized keys for events module, especially for caching and idempotency.
 */
export const EVENT_KEY = {
  IDEMPOTENCY: (uniqueId: string) =>
    CacheKeyFactory.idempotency('event', 'job', uniqueId),
} as const;
