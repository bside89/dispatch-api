import { WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

export abstract class BaseProcessor extends WorkerHost {
  protected readonly logger: Logger;

  constructor(protected readonly processorName: string) {
    super();
    this.logger = new Logger(processorName);
  }
}
