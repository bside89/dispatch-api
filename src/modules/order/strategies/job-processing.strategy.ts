import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

export interface JobProcessingStrategy<T = any> {
  execute(job: Job<T>, logger: Logger): Promise<void>;
}

export abstract class BaseJobStrategy<
  T = any,
> implements JobProcessingStrategy<T> {
  protected async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  abstract execute(job: Job<T>, logger: Logger): Promise<void>;
}
