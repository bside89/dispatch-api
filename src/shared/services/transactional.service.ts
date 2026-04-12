import Redlock from 'redlock';
import { DataSource } from 'typeorm';
import { BaseService } from './base.service';

/**
 * Base class for services that require transactional operations with distributed
 * locking. It provides a constructor that accepts a DataSource and Redlock instance,
 * which are essential for managing transactions and locks. Services that extend this
 * class can utilize the Transactional and UseLock decorators to ensure that
 * their methods are executed within a transaction and with the appropriate locks.
 */
export abstract class TransactionalService extends BaseService {
  constructor(
    serviceName: string,
    protected readonly dataSource: DataSource,
    protected readonly redlock: Redlock,
  ) {
    super(serviceName);
  }
}
