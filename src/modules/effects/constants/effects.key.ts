import { CacheKeyFactory } from '@/shared/modules/cache/factories/cache-key.factory';

/**
 * Centralized keys for effects module, especially for idempotency.
 */
export const EFFECT_KEY = {
  IDEMPOTENCY: (uniqueId: string) =>
    CacheKeyFactory.idempotency('effect', 'job', uniqueId),
} as const;
