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

  // Run some piece of code without throwing an error, and log the error if it happens
  protected async runAndIgnoreError<T>(
    fn: () => Promise<T>,
    context: string,
  ): Promise<T | null> {
    try {
      return await fn();
    } catch (error) {
      this.logger.warn(
        `Non-critical error ignored in ${context}: ${error.message}`,
      );
      return null;
    }
  }
}
