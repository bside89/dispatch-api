import { IEventBusJob } from './event-bus-job.interface';

export interface IEventBus {
  publish(event: IEventBusJob): Promise<void>;

  publishBulk(events: IEventBusJob[]): Promise<void>;
}
