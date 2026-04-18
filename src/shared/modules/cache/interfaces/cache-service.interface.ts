import { IBaseService } from '@/shared/services/base-service.interface';

export interface ICacheService extends IBaseService {
  get<T>(key: string): Promise<T | undefined>;

  set<T>(key: string, value: T, ttl?: number): Promise<void>;

  delete(key: string): Promise<void>;

  deletePattern(listCacheKey: string): Promise<void>;

  deleteBulk(options: { keys?: string[]; patterns?: string[] }): Promise<void>;
}
