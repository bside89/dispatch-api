import { CacheService } from '@/shared/modules/cache/cache.service';
import { BaseService } from './base.service';
import { runAndIgnoreError } from '../helpers/functions';

export abstract class CacheableService extends BaseService {
  constructor(
    protected readonly serviceName: string,
    protected readonly cacheService: CacheService,
  ) {
    super(serviceName);
  }

  /**
   * Invalidates cache entries based on the provided options.
   * @param options Object containing keys and patterns to delete from the cache.
   */
  protected async invalidateCache(options: {
    keysToDelete?: string[];
    patternsToDelete?: string[];
  }): Promise<void> {
    const keysToDelete: string[] = options.keysToDelete || [];
    const patternsToDelete: string[] = options.patternsToDelete || [];

    await Promise.all([
      // Delete specific keys
      ...keysToDelete.map((key) =>
        runAndIgnoreError(
          () => this.cacheService.delete(key),
          `deleting cache key: ${key}`,
          this.logger,
        ),
      ),
      // Delete pattern-based keys
      ...patternsToDelete.map((pattern) =>
        runAndIgnoreError(
          () => this.cacheService.deletePattern(pattern),
          `deleting cache pattern: ${pattern}`,
          this.logger,
        ),
      ),
    ]);

    this.logger.debug('Cleared cache', {
      keysDeleted: keysToDelete.join(', '),
      patternsDeleted: patternsToDelete.join(', '),
    });
  }
}
