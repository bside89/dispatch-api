import { CacheKeyFactory } from '@/shared/modules/cache/factories/cache-key.factory';

/**
 * Centralized keys for side effects module, especially for caching and idempotency.
 */
export const SIDE_EFFECT_KEY = {
  IDEMPOTENCY: (uniqueId: string) =>
    CacheKeyFactory.idempotency('side-effect', 'job', uniqueId),
} as const;
