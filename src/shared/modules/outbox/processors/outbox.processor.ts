import { EVENT_BUS } from '@/shared/modules/events/constants/event-bus.token';
import { EventBus } from '@/shared/modules/events/interfaces/event-bus.interface';
import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { OutboxRepository } from '../repositories/outbox.repository';
import { OutboxType } from '../enums/outbox-type.enum';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Outbox } from '../entities/outbox.entity';

@Injectable()
export class OutboxProcessor {
  private readonly logger = new Logger(OutboxProcessor.name);

  private isProcessing = false;

  constructor(
    @InjectQueue('orders')
    protected readonly orderQueue: Queue,
    @Inject(EVENT_BUS)
    protected readonly eventBus: EventBus,

    private readonly outboxRepository: OutboxRepository,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async process() {
    if (this.isProcessing) {
      // Outbox is already being processed, skip this cycle to prevent overlapping
      return;
    }
    this.isProcessing = true;

    try {
      const messages = await this.outboxRepository.findAllByCreatedAt();

      for (const msg of messages) {
        try {
          this.logger.debug(
            `CorrelationId saved in the Outbox: ${msg.correlationId}`,
          );

          await this.dispatch(msg);

          await this.outboxRepository.delete(msg.id);

          this.logger.log(
            `Successfully processed Outbox ${msg.id} of type ${msg.type}`,
          );
        } catch (e) {
          // Try again in the next cycle, but log the error for debugging
          this.logger.error(
            `Failed to process Outbox ${msg.id} of type ${msg.type}`,
            e,
          );
        }
      }
    } catch (e) {
      this.logger.error('Error during outbox processing cycle', e);
    } finally {
      this.isProcessing = false;
    }
  }

  private async dispatch(msg: Outbox): Promise<void> {
    const type = msg.type;
    if (
      type === OutboxType.ORDER_PROCESS ||
      type === OutboxType.ORDER_SHIP ||
      type === OutboxType.ORDER_DELIVER ||
      type === OutboxType.ORDER_CANCEL
    ) {
      await this.orderQueue.add(type, msg.payload);
    }
    if (type === OutboxType.EVENTS_NOTIFY_USER) {
      await this.eventBus.publish(type, msg.payload);
    }
  }
}
