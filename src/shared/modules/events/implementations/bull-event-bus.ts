import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { BulkJobOptions, Queue } from 'bullmq';
import { EventBus } from '../interfaces/event-bus.interface';
import { EVENT_QUEUE_TOKEN } from '../constants/event-queue.token';

@Injectable()
export class BullEventBus implements EventBus {
  constructor(@InjectQueue(EVENT_QUEUE_TOKEN) private readonly queue: Queue) {}

  async publish(name: string, event: any): Promise<void> {
    await this.queue.add(name, event);
  }

  async publishBulk(
    events: {
      name: string;
      data: any;
      opts?: BulkJobOptions;
    }[],
  ): Promise<void> {
    await this.queue.addBulk(events);
  }
}
