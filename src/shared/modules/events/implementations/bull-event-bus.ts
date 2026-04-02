import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { BulkJobOptions, Queue } from 'bullmq';
import { EventBus } from '../interfaces/event-bus.interface';

@Injectable()
export class BullEventBus implements EventBus {
  constructor(@InjectQueue('events') private readonly queue: Queue) {}

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
