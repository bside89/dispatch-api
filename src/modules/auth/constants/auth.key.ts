import { CacheKeyFactory } from '@/shared/modules/cache/factories/cache-key.factory';

export const AUTH_KEY = {
  BLACKLIST: (token: string) => CacheKeyFactory.blacklist(token),
} as const;
