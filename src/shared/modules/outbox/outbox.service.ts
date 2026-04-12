import { Outbox } from './entities/outbox.entity';
import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { OutboxType } from './enums/outbox-type.enum';
import { OutboxRepository } from './repositories/outbox.repository';
import { RequestContext } from '@/shared/utils/request-context';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import type { EventBus } from '../events/interfaces/event-bus.interface';
import { Queue } from 'bullmq';
import { EVENT_BUS } from '../events/constants/event-bus.token';
import { InjectQueue } from '@nestjs/bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Transactional } from '@/shared/decorators/transactional.decorator';
import {
  ORDER_QUEUE_TOKEN,
  PAYMENT_QUEUE_TOKEN,
} from '@/shared/constants/queue-tokens';
import { OutboxPayloadMap } from './types/outbox-payload.map';
import { ensureError } from '@/shared/helpers/functions';
import { EventBusJob } from '../events/interfaces/event-bus-job.interface';
import Redlock from 'redlock';
import { TransactionalService } from '@/shared/services/transactional.service';

@Injectable()
export class OutboxService extends TransactionalService implements OnModuleDestroy {
  private isProcessing = false;

  private isShuttingDown = false;

  constructor(
    @InjectQueue(ORDER_QUEUE_TOKEN)
    protected readonly orderQueue: Queue,
    @InjectQueue(PAYMENT_QUEUE_TOKEN)
    protected readonly paymentQueue: Queue,
    @Inject(EVENT_BUS)
    protected readonly eventBus: EventBus,

    private readonly outboxRepository: OutboxRepository,
    dataSource: DataSource,
    redlock: Redlock,
  ) {
    super(OutboxService.name, dataSource, redlock);
  }

  async onModuleDestroy(): Promise<void> {
    // Wait until any ongoing processing is finished before allowing shutdown to proceed
    this.isShuttingDown = true;
    while (this.isProcessing) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  @Transactional()
  async process() {
    if (this.isShuttingDown || this.isProcessing) {
      // Outbox is already being processed or shutting down, skip this cycle
      return;
    }
    this.isProcessing = true;

    try {
      const limit = 100;
      const messages = await this.outboxRepository.findAndLockBatch(limit);

      if (messages.length === 0) return;

      await this.dispatch(messages);

      const dispatchedIds: string[] = messages.map((m) => m.id);

      await this.outboxRepository.deleteBulk(dispatchedIds);

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
    } catch (e) {
      const error = ensureError(e);
      this.logger.error(`Error during Outbox processing cycle: ${error.message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  private async dispatch(messages: Outbox[]): Promise<void> {
    if (messages.length === 0) return;

    // Separate messages based on their type to determine the appropriate dispatch
    // method (queue vs event bus)
    const orderQueueMsg = messages
      .filter((m) =>
        [
          OutboxType.ORDER_PROCESS,
          OutboxType.ORDER_SHIP,
          OutboxType.ORDER_DELIVER,
          OutboxType.ORDER_CANCEL,
          OutboxType.ORDER_REFUND,
        ].includes(m.type),
      )
      .map(
        (msg) =>
          ({
            name: msg.type,
            data: msg.payload,
            jobId: msg.id,
          }) as EventBusJob,
      );
    const paymentQueueMsg = messages
      .filter((m) =>
        [
          OutboxType.PAYMENT_CREATE_CUSTOMER,
          OutboxType.PAYMENT_UPDATE_CUSTOMER,
          OutboxType.PAYMENT_DELETE_CUSTOMER,
        ].includes(m.type),
      )
      .map(
        (msg) =>
          ({
            name: msg.type,
            data: msg.payload,
            jobId: msg.id,
          }) as EventBusJob,
      );
    const eventBusMsg = messages
      .filter((m) => m.type === OutboxType.EVENTS_NOTIFY_USER)
      .map(
        (msg) =>
          ({
            name: msg.type,
            data: msg.payload,
            jobId: msg.id,
          }) as EventBusJob,
      );

    if (orderQueueMsg.length > 0) {
      await this.orderQueue.addBulk(orderQueueMsg);
    }
    if (paymentQueueMsg.length > 0) {
      await this.paymentQueue.addBulk(paymentQueueMsg);
    }
    if (eventBusMsg.length > 0) {
      await this.eventBus.publishBulk(eventBusMsg);
    }
  }

  async add<T extends OutboxType>(
    type: T,
    payload: OutboxPayloadMap[T],
  ): Promise<void> {
    const correlationId = RequestContext.getCorrelationId() ?? randomUUID();
    const outboxEntry = this.outboxRepository.createEntity({
      type,
      payload,
      correlationId,
      createdAt: new Date(),
    });
    await this.outboxRepository.save(outboxEntry);

    // Trigger immediate processing after adding a new message to the outbox
    setImmediate(() => this.process());
  }
}
