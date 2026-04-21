import { Injectable } from '@nestjs/common';
import Redlock from 'redlock';
import { DataSource, EntityManager } from 'typeorm';
import { TransactionContext } from '@/shared/utils/transaction-context.utils';
import { CACHE_TTL } from '@/shared/constants/cache-ttl.constant';

@Injectable()
export class DbGuardService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redlock: Redlock,
  ) {}

  /**
   * Executes the provided work within a database transaction.
   * @param work The work to be executed within the transaction.
   * @returns The result of the work.
   */
  async transaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.dataSource.transaction((manager) =>
      TransactionContext.run(manager, () => work(manager)),
    );
  }

  /**
   * Acquires a lock and executes the provided work within the lock.
   * @param key The key for the lock.
   * @param work The work to be executed within the lock.
   * @param ttl The time-to-live for the lock in milliseconds. If not provided, a
   * default value will be used.
   * @returns The result of the work.
   */
  async lock<T>(key: string, work: () => Promise<T>, ttl?: number): Promise<T> {
    const lock = await this.redlock.acquire([key], ttl ?? CACHE_TTL.LOCK);
    try {
      return await work();
    } finally {
      // Release errors (e.g. lock expired before release) are non-fatal: the work is
      // already done and no duplicate execution is possible at this point.
      // Swallowing keeps the caller clean and avoids unhandled rejections when Redis
      // is flushed externally (e.g. in tests).
      await this.redlock.release(lock).catch(() => undefined);
    }
  }

  /**
   * Acquires a lock and executes a transaction within the lock.
   * @param key The key for the lock.
   * @param work The work to be executed within the lock and transaction.
   * @param ttl The time-to-live for the lock in milliseconds. If not provided, a
   * default value will be used.
   * @returns The result of the work.
   */
  async lockAndTransaction<T>(
    key: string,
    work: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    return this.lock(key, () => this.transaction(() => work()), ttl);
  }
}
