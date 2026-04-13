import { EventBusJob } from './event-bus-job.interface';

export interface EventBus {
  publish(event: EventBusJob): Promise<void>;

  publishBulk(events: EventBusJob[]): Promise<void>;
}
