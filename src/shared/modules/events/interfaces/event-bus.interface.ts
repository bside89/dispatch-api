import { EventBusJob } from './event-bus-job.interface';

export interface EventBus {
  publish(events: EventBusJob[]): Promise<void>;

  publishBulk(events: EventBusJob[]): Promise<void>;
}
