import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { BulkJobOptions, Queue } from 'bullmq';
import { IEventBus as IEventBus } from '../interfaces/event-bus.interface';
import { EVENT_QUEUE_TOKEN } from '@/shared/constants/queue-tokens.constant';
import { IEventBusJob } from '../interfaces/event-bus-job.interface';

@Injectable()
export class EventBus implements IEventBus {
  constructor(@InjectQueue(EVENT_QUEUE_TOKEN) private readonly queue: Queue) {}

  async publish(event: IEventBusJob): Promise<void> {
    await this.queue.add(event.name, event.data, { jobId: event.jobId });
  }

  async publishBulk(events: IEventBusJob[]): Promise<void> {
    const eventsFormatted = events.map((event) => ({
      name: event.name,
      data: event.data,
      opts: {
        jobId: event.jobId,
      } as BulkJobOptions,
    }));
    await this.queue.addBulk(eventsFormatted);
  }
}
