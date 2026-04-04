import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { BaseJobPayload } from '../jobs/base-job.payload';

export abstract class BaseJobStrategy<T extends BaseJobPayload> {
  protected readonly logger: Logger;

  constructor(protected readonly jobName: string) {
    this.logger = new Logger(jobName);
  }

  abstract execute(job: Job<T>): Promise<void>;

  abstract executeOnFailed(job: Job<T>, error: Error): Promise<void>;
}
