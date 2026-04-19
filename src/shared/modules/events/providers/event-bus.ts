import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { BulkJobOptions, Queue } from 'bullmq';
import { IEventBus as IEventBus } from '../interfaces/event-bus.interface';
import { EVENT_QUEUE } from '@/shared/constants/queues.token';
import { EventBusJob } from '../interfaces/event-bus-job.interface';
import { BaseJobPayload } from '@/shared/payloads/base-job.payload';

@Injectable()
export class EventBus implements IEventBus {
  constructor(@InjectQueue(EVENT_QUEUE) private readonly queue: Queue) {}

  async publish<T extends BaseJobPayload>(event: EventBusJob<T>): Promise<void> {
    const name = event.job.name;
    const data = event.job.data;
    const opts = event.job.opts as BulkJobOptions;
    await this.queue.add(name, data, opts);
  }

  async publishBulk<T extends BaseJobPayload>(
    events: EventBusJob<T>[],
  ): Promise<void> {
    const eventsFormatted = events.map((event) => ({
      name: event.job.name,
      data: event.job.data,
      opts: event.job.opts as BulkJobOptions,
    }));
    await this.queue.addBulk(eventsFormatted);
  }
}
