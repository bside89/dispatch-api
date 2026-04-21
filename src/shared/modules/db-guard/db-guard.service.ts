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
      await this.redlock.release(lock);
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
