import { BaseQueryDto } from '@/shared/dto/base-query.dto';
import { CacheKeyFactory } from '@/shared/modules/cache/factories/cache-key.factory';

export const USER_KEY = {
  IDEMPOTENCY: (operation: string, uniqueId: string) =>
    CacheKeyFactory.idempotency('user', operation, uniqueId),

  CACHE_FIND_ALL: <T extends BaseQueryDto>(query: T) =>
    CacheKeyFactory.cache('user', 'findAll', JSON.stringify(query)),

  CACHE_FIND_ONE: (id: string) => CacheKeyFactory.cache('user', 'findOne', id),

  CACHE_FIND_BY_EMAIL: (email: string) =>
    CacheKeyFactory.cache('user', 'findByEmail', email),

  CACHE_FIND_ALL_PATTERN: () => CacheKeyFactory.cachePattern('user', 'findAll'),
} as const;
