import Redlock from 'redlock';
import { DataSource } from 'typeorm';
import { BaseService } from './base.service';

export abstract class TransactionalService extends BaseService {
  constructor(
    serviceName: string,
    protected readonly dataSource: DataSource,
    protected readonly redlock: Redlock,
  ) {
    super(serviceName);
  }
}
