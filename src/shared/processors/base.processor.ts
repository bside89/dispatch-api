import { WorkerHost } from '@nestjs/bullmq';
import * as os from 'os';
import { AppLogger } from '../utils/app-logger';

export abstract class BaseProcessor extends WorkerHost {
  protected readonly logger: AppLogger;

  constructor(protected readonly processorName: string) {
    super();
    this.logger = new AppLogger(processorName);
  }

  /**
   * Sets up the concurrency for the worker.
   * @param concurrency The desired concurrency level. If not provided, it will be
   * calculated based on the number of CPU cores and a multiplier.
   */
  protected setupConcurrency(concurrency?: number) {
    const multiplier = this.getConcurrencyMultiplier();
    this.worker.concurrency = concurrency ?? os.cpus().length * multiplier;
  }

  /**
   * Returns the multiplier to be used for calculating the concurrency based on the
   * number of CPU cores. This method should be implemented by subclasses to provide
   * the appropriate multiplier for their specific use case.
   * @returns The concurrency multiplier. For example, if the processor is I/O-bound,
   * it might return a higher multiplier (e.g., 2 or 3) to allow for more concurrent
   * processing. If the processor is CPU-bound, it might return a lower multiplier
   * (e.g.,
   * 1) to avoid overloading the CPU.
   */
  protected abstract getConcurrencyMultiplier(): number;
}
