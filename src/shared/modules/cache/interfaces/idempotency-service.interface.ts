export interface IIdempotencyService {
  /**
   * Returns a cached result for the given key if it exists,
   * otherwise executes fn(), caches the result, and returns it.
   */
  getOrExecute<T>(cacheKey: string, fn: () => Promise<T>): Promise<T>;
}
