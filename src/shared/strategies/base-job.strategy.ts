import { Job } from 'bullmq';
import { BaseJobPayload } from '../payloads/base-job.payload';
import { AppLogger } from '../utils/app-logger.utils';

export abstract class BaseJobStrategy<T extends BaseJobPayload> {
  protected readonly logger: AppLogger;

  constructor(jobName: string) {
    this.logger = new AppLogger(jobName);
  }

  abstract execute(job: Job<T>): Promise<void>;

  abstract executeAfterFail(job: Job<T>, error: Error): Promise<void>;
}
