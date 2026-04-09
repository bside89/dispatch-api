import { CacheKeyFactory } from '@/shared/modules/cache/factories/cache-key.factory';

/**
 * Centralized keys for payments module, especially for caching and idempotency.
 */
export const PAYMENT_KEY = {
  IDEMPOTENCY: (method: string, id: string) =>
    CacheKeyFactory.idempotency('payment', method, id),
} as const;
