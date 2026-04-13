import { BaseJobPayload } from '../payloads/base-job.payload';

export interface QueueJob<T extends BaseJobPayload> {
  name: string;

  data: T;

  opts: {
    jobId: string;
  };
}
