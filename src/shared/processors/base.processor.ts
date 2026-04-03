import { CacheService } from '@/modules/cache/cache.service';
import { WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import * as os from 'os';

export abstract class BaseProcessor extends WorkerHost {
  protected readonly logger: Logger;

  constructor(
    protected readonly cacheService: CacheService,
    protected readonly processorName: string,
  ) {
    super();
    this.logger = new Logger(processorName);
  }

  protected setupConcurrency(concurrency?: number) {
    const multiplier = this.getConcurrencyMultiplier();
    this.worker.concurrency = concurrency ?? os.cpus().length * multiplier;
  }

  protected abstract getConcurrencyMultiplier(): number;
}
