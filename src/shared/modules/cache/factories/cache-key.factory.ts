export class CacheKeyFactory {
  private static readonly PREFIX = 'api';

  /**
   * Template: api:idempotency:resource:operation:uniqueId
   */
  static idempotency(resource: string, operation: string, uniqueId: string) {
    return `${this.PREFIX}:idempotency:${resource}:${operation}:${uniqueId}`;
  }

  /**
   * Template: api:cache:resource:method:uniqueId
   */
  static cache(resource: string, method: string, uniqueId: string) {
    return `${this.PREFIX}:cache:${resource}:${method}:${uniqueId}`;
  }

  /**
   * Template: api:cache:resource:method:*
   */
  static cachePattern(resource: string, method: string) {
    return `${this.PREFIX}:cache:${resource}:${method}:*`;
  }

  /**
   * Template: api:validate:param
   */
  static validate(param: string) {
    return `${this.PREFIX}:validate:${param}`;
  }

  /*
   * Template: api:blacklist:id
   */
  static blacklist(uniqueId: string) {
    return `${this.PREFIX}:blacklist:${uniqueId}`;
  }

  /**
   * For Jobs (Saga/Queues)
   * Template: api:job:jobName:uniqueId
   */
  static job(jobName: string, uniqueId: string) {
    return `${this.PREFIX}:job:${jobName}:${uniqueId}`;
  }
}
