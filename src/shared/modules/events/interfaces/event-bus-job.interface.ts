import { QueueJob } from '@/shared/interfaces/queue-job.interface';
import { BaseJobPayload } from '@/shared/payloads/base-job.payload';

export interface EventBusJob<T extends BaseJobPayload> {
  job: QueueJob<T>;
}
