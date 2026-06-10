import {
  EFFECTS_QUEUE,
  ORDER_QUEUE,
  PAYMENT_QUEUE,
  USER_QUEUE,
} from '@/shared/constants/queues.token';
import { BaseScheduler } from '@/shared/providers/schedulers/base.scheduler';
import { ensureError } from '@/shared/utils/functions.utils';
import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import { DbGuardService } from '../../db-guard/db-guard.service';
import { OUTBOX_REPOSITORY } from '../constants/outbox.token';
import { Outbox } from '../entities/outbox.entity';
import { OutboxDispatcher } from '../helpers/outbox-dispatcher';
import type { IOutboxRepository } from '../interfaces/outbox-repository.interface';

@Injectable()
export class OutboxScheduler extends BaseScheduler implements OnModuleDestroy {
  private isProcessing = false;

  private isShuttingDown = false;

  constructor(
    @InjectQueue(ORDER_QUEUE) private readonly orderQueue: Queue,
    @InjectQueue(PAYMENT_QUEUE) private readonly paymentQueue: Queue,
    @InjectQueue(EFFECTS_QUEUE) private readonly effectQueue: Queue,
    @InjectQueue(USER_QUEUE) private readonly userQueue: Queue,
    @Inject(OUTBOX_REPOSITORY) private readonly outboxRepository: IOutboxRepository,
    private readonly guard: DbGuardService,
  ) {
    super(OutboxScheduler.name);
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

    const { orderQueueMsg, paymentQueueMsg, effectQueueMsg, userQueueMsg } =
      OutboxDispatcher.partition(messages);

    if (orderQueueMsg.length > 0) {
      await this.orderQueue.addBulk(orderQueueMsg);
    }
    if (paymentQueueMsg.length > 0) {
      await this.paymentQueue.addBulk(paymentQueueMsg);
    }
    if (effectQueueMsg.length > 0) {
      await this.effectQueue.addBulk(effectQueueMsg);
    }
    if (userQueueMsg.length > 0) {
      await this.userQueue.addBulk(userQueueMsg);
    }
  }
}
