import { WorkerHost } from '@nestjs/bullmq';
import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import * as os from 'os';

export abstract class BaseProcessor
  extends WorkerHost
  implements OnApplicationBootstrap
{
  protected readonly logger: Logger;

  constructor(protected readonly processorName: string) {
    super();
    this.logger = new Logger(processorName);
  }

  onApplicationBootstrap(): void {
    this.worker.concurrency = os.cpus().length;
  }
}
