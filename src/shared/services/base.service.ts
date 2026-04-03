import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OutboxService } from '../modules/outbox/outbox.service';

export abstract class BaseService {
  protected readonly logger: Logger;

  constructor(
    protected readonly dataSource: DataSource,
    protected readonly serviceName: string,
    protected readonly outboxService: OutboxService,
  ) {
    this.logger = new Logger(serviceName);
  }
}
