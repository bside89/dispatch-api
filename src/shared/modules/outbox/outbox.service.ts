import { Outbox } from './entities/outbox.entity';
import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import type { IOutboxRepository } from './interfaces/outbox-repository.interface';
import { OUTBOX_REPOSITORY } from './constants/outbox.token';
import { RequestContext } from '@/shared/utils/request-context.utils';
import { randomUUID } from 'crypto';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ORDER_QUEUE, PAYMENT_QUEUE } from '@/shared/constants/queues.token';
import { ensureError } from '@/shared/utils/functions.utils';
import { IOutboxService } from './interfaces/outbox-service.interface';
import { BaseService } from '@/shared/services/base.service';
import { DbGuardService } from '../db-guard/db-guard.service';
import { BaseOutboxJobPayload } from './payloads/outbox.payload';
import { OutboxDispatcher } from './helpers/outbox-dispatcher';
import { SIDE_EFFECTS_QUEUE } from '@/shared/constants/queues.token';

@Injectable()
export class OutboxService
  extends BaseService
  implements OnModuleDestroy, IOutboxService
{
  private isProcessing = false;

  private isShuttingDown = false;

  constructor(
    @InjectQueue(ORDER_QUEUE) private readonly orderQueue: Queue,
    @InjectQueue(PAYMENT_QUEUE) private readonly paymentQueue: Queue,
    @InjectQueue(SIDE_EFFECTS_QUEUE) private readonly sideEffectQueue: Queue,
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
  process(): Promise<void> {
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

    const { orderQueueMsg, paymentQueueMsg, sideEffectQueueMsg } =
      OutboxDispatcher.partition(messages);

    if (orderQueueMsg.length > 0) {
      await this.orderQueue.addBulk(orderQueueMsg);
    }
    if (paymentQueueMsg.length > 0) {
      await this.paymentQueue.addBulk(paymentQueueMsg);
    }
    if (sideEffectQueueMsg.length > 0) {
      await this.sideEffectQueue.addBulk(sideEffectQueueMsg);
    }
  }

  async add<T extends BaseOutboxJobPayload>(outboxPayload: T): Promise<void> {
    const correlationId = RequestContext.getCorrelationId() ?? randomUUID();
    const outboxEntry = this.outboxRepository.createEntity({
      type: outboxPayload.type,
      payload: outboxPayload,
      correlationId,
    });
    await this.outboxRepository.save(outboxEntry);

    // Trigger immediate processing after adding a new message to the outbox
    setImmediate(() => this.process());
  }
}
