import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { EventBus } from '../interfaces/event-bus.interface';

@Injectable()
export class BullEventBus implements EventBus {
  constructor(@InjectQueue('events') private readonly queue: Queue) {}

  async publish(event: any): Promise<void> {
    const name = event.constructor.name;

    await this.queue.add(name, event);
  }
}
