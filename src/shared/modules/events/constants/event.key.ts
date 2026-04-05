import { CacheKeyFactory } from '../../cache/factories/cache-key.factory';

export const EVENT_KEY = {
  IDEMPOTENCY: (uniqueId: string) =>
    CacheKeyFactory.idempotency('event', 'job', uniqueId),
} as const;
