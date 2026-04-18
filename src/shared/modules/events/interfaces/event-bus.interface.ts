import { BaseJobPayload } from '@/shared/payloads/base-job.payload';
import { EventBusJob } from './event-bus-job.interface';

export interface IEventBus {
  publish<T extends BaseJobPayload>(event: EventBusJob<T>): Promise<void>;

  publishBulk<T extends BaseJobPayload>(events: EventBusJob<T>[]): Promise<void>;
}
