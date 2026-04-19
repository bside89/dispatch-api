import { Outbox } from './entities/outbox.entity';
import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import type { IOutboxRepository } from './interfaces/outbox-repository.interface';
import { OUTBOX_REPOSITORY } from './constants/outbox.token';
import { RequestContext } from '@/shared/utils/request-context';
import { randomUUID } from 'crypto';
import type { IEventBus } from '../events/interfaces/event-bus.interface';
import { Queue } from 'bullmq';
import { EVENT_BUS } from '../events/constants/event-bus.token';
import { InjectQueue } from '@nestjs/bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ORDER_QUEUE, PAYMENT_QUEUE } from '@/shared/constants/queues.token';
import { ensureError } from '@/shared/helpers/functions';
import { IOutboxService } from './interfaces/outbox-service.interface';
import { BaseService } from '@/shared/services/base.service';
import { DbGuardService } from '../db-guard/db-guard.service';
import { BaseOutboxJobPayload } from './payloads/outbox.payload';
import { OutboxDispatcher } from './helpers/outbox-dispatcher';

@Injectable()
export class OutboxService
  extends BaseService
  implements OnModuleDestroy, IOutboxService
{
  private isProcessing = false;

  private isShuttingDown = false;

  private readonly dispatcher = new OutboxDispatcher();

  constructor(
    @InjectQueue(ORDER_QUEUE) private readonly orderQueue: Queue,
    @InjectQueue(PAYMENT_QUEUE) private readonly paymentQueue: Queue,
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
    @Inject(OUTBOX_REPOSITORY) private readonly outboxRepository: IOutboxRepository,
    private readonly guard: DbGuardService,
  ) {
    super(OutboxService.name);
  }

  async onModuleDestroy(): Promise<void> {
    // Wait until any ongoing processing is finished before allowing shutdown to proceed
    this.isShuttingDown = true;
    while (this.isProcessing) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async process(): Promise<void> {
    return this.guard.transaction(() => this._process());
  }

  private async _process() {
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

    const { orderQueueMsg, paymentQueueMsg, eventBusMsg } =
      this.dispatcher.partition(messages);

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

  async add<T extends BaseOutboxJobPayload>(outboxPayload: T): Promise<void> {
    const correlationId = RequestContext.getCorrelationId() ?? randomUUID();
    const outboxEntry = this.outboxRepository.createEntity({
      type: outboxPayload.type,
      payload: outboxPayload,
      correlationId,
      createdAt: new Date(),
    });
    await this.outboxRepository.save(outboxEntry);

    // Trigger immediate processing after adding a new message to the outbox
    setImmediate(() => this.process());
  }
}
