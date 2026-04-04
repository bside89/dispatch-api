import { EVENT_BUS } from '@/shared/modules/events/constants/event-bus.token';
import type { EventBus } from '@/shared/modules/events/interfaces/event-bus.interface';
import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { OutboxRepository } from '../repositories/outbox.repository';
import { OutboxType } from '../enums/outbox-type.enum';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Outbox } from '../entities/outbox.entity';
import { Transactional } from '@/shared/decorators/transactional.decorator';
import { DataSource } from 'typeorm';
import { AppLogger } from '@/shared/utils/app-logger';

@Injectable()
export class OutboxProcessor {
  private readonly logger = new AppLogger(OutboxProcessor.name);

  private isProcessing = false;

  constructor(
    @InjectQueue('orders')
    protected readonly orderQueue: Queue,
    @Inject(EVENT_BUS)
    protected readonly eventBus: EventBus,

    private readonly outboxRepository: OutboxRepository,
    protected readonly dataSource: DataSource,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  @Transactional()
  async process() {
    if (this.isProcessing) {
      // Outbox is already being processed, skip this cycle to prevent overlapping
      return;
    }
    this.isProcessing = true;

    try {
      const limit = 100;
      const messages = await this.outboxRepository.findAndLockBatch(limit);

      if (messages.length === 0) return;

      await this.dispatch(messages);

      const dispatchedIds: string[] = messages.map((m) => m.id);

      await this.outboxRepository.deleteMany(dispatchedIds);

      this.logger.log(
        `Successfully processed batch of ${messages.length} Outbox messages.`,
      );

      // CONTROLLED RECURSION:
      // If we reached the maximum limit, schedule the next execution immediately
      if (messages.length === limit) {
        this.isProcessing = false; // Release the lock for the next execution
        setImmediate(() => this.process());
        return;
      }
    } catch (error: any) {
      this.logger.error('Error during Outbox processing cycle', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async dispatch(msg: Outbox[]): Promise<void> {
    if (msg.length === 0) return;

    const orderQueueMsg = msg
      .filter((m) =>
        [
          OutboxType.ORDER_PROCESS,
          OutboxType.ORDER_SHIP,
          OutboxType.ORDER_DELIVER,
          OutboxType.ORDER_CANCEL,
        ].includes(m.type),
      )
      .map((msg) => ({
        name: msg.type,
        data: msg.payload,
        opts: { jobId: msg.id },
      }));

    const eventBusMsg = msg
      .filter((m) => m.type === OutboxType.EVENTS_NOTIFY_USER)
      .map((msg) => ({
        name: msg.type,
        data: msg.payload,
        opts: { jobId: msg.id },
      }));

    if (orderQueueMsg.length > 0) {
      await this.orderQueue.addBulk(orderQueueMsg);
    }
    if (eventBusMsg.length > 0) {
      await this.eventBus.publishBulk(eventBusMsg);
    }
  }
}
