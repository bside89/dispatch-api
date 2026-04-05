import { CacheKeyFactory } from '@/shared/modules/cache/factories/cache-key.factory';
import { OrderQueryDto } from '../dto/order-query.dto';

export const ORDER_KEY = {
  IDEMPOTENCY: (method: string, id: string) =>
    CacheKeyFactory.idempotency('order', method, id),

  CACHE_FIND_ONE: (id: string) => CacheKeyFactory.cache('order', 'findOne', id),

  CACHE_FIND_ALL: (query: Partial<OrderQueryDto>) =>
    CacheKeyFactory.cache('order', 'findAll', JSON.stringify(query)),

  CACHE_FIND_ALL_PATTERN: () => CacheKeyFactory.cachePattern('order', 'findAll'),

  VALIDATE_IF_PAID: (param: string) => CacheKeyFactory.validate(param),
} as const;
