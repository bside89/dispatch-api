import { AsyncLocalStorage } from 'async_hooks';
import { EntityManager } from 'typeorm';

export class TransactionContext {
  private static storage = new AsyncLocalStorage<EntityManager>();

  // Run a function within a transaction context
  static run(manager: EntityManager, fn: () => Promise<any>) {
    return this.storage.run(manager, fn);
  }

  // Get the current transaction manager
  static getManager(): EntityManager | undefined {
    return this.storage.getStore();
  }
}
