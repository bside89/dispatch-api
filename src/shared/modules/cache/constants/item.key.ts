import { CacheKeyFactory } from '../factories/cache-key.factory';

export const ITEM_KEY = {
  IDEMPOTENCY: (operation: string, uniqueId: string) =>
    CacheKeyFactory.idempotency('item', operation, uniqueId),

  CACHE_FIND_ALL: <T extends object>(query: T) =>
    CacheKeyFactory.cache('item', 'findAll', JSON.stringify(query)),

  CACHE_FIND_ONE: (id: string) => CacheKeyFactory.cache('item', 'findOne', id),

  CACHE_FIND_ALL_PATTERN: () => CacheKeyFactory.cachePattern('item', 'findAll'),
} as const;
