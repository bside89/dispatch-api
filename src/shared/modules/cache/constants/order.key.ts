import { CacheKeyFactory } from '@/shared/modules/cache/factories/cache-key.factory';
import { BaseQueryDto } from '@/shared/dto/base-query.dto';

/**
 * Centralized keys for orders module, especially for caching and idempotency.
 */
export const ORDER_KEY = {
  IDEMPOTENCY: (method: string, id: string) =>
    CacheKeyFactory.idempotency('order', method, id),

  CACHE_FIND_ONE: (id: string) => CacheKeyFactory.cache('order', 'findOne', id),

  CACHE_FIND_ALL: <T extends BaseQueryDto>(query: T) =>
    CacheKeyFactory.cache('order', 'findAll', JSON.stringify(query)),

  CACHE_FIND_ALL_PATTERN: () => CacheKeyFactory.cachePattern('order', 'findAll'),

  VALIDATE_IF_PAID: (param: string) => CacheKeyFactory.validate(param),
} as const;
