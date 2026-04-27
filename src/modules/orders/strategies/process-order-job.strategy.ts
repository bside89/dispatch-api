import { Injectable, Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import { OrderStatus } from '../enums/order-status.enum';
import {
  CancelOrderJobPayload,
  ProcessOrderJobPayload,
  RefundOrderJobPayload,
} from '@/shared/payloads/orders-job.payload';
import { NotifyUserJobPayload } from '@/shared/payloads/effects-job.payload';
import { ensureError } from '@/shared/utils/functions.utils';
import { CACHE_SERVICE } from '@/shared/modules/cache/constants/cache.token';
import type { ICacheService } from '@/shared/modules/cache/interfaces/cache-service.interface';
import { OUTBOX_SERVICE } from '@/shared/modules/outbox/constants/outbox.token';
import type { IOutboxService } from '@/shared/modules/outbox/interfaces/outbox-service.interface';
import { ORDER_REPOSITORY } from '../constants/orders.token';
import type { IOrderRepository } from '../interfaces/order-repository.interface';
import { BaseOrderJobStrategy } from './base-order-job.strategy';
import { OrderMessageFactory } from '../factories/order-message.factory';
import { Order } from '../entities/order.entity';
import { DbGuardService } from '@/shared/modules/db-guard/db-guard.service';
import { OrderTransitionPolicy } from '../helpers/order-transition-policy';

@Injectable()
export class ProcessOrderJobStrategy extends BaseOrderJobStrategy<ProcessOrderJobPayload> {
  constructor(
    private readonly messages: OrderMessageFactory,
    @Inject(OUTBOX_SERVICE) private readonly outboxService: IOutboxService,
    @Inject(CACHE_SERVICE) cacheService: ICacheService,
    @Inject(ORDER_REPOSITORY) orderRepository: IOrderRepository,
    guard: DbGuardService,
  ) {
    super(ProcessOrderJobStrategy.name, cacheService, orderRepository, guard);
  }

  execute(job: Job<ProcessOrderJobPayload>): Promise<void> {
    return this.guard.transaction(() => this._execute(job));
  }

  private async _execute(job: Job<ProcessOrderJobPayload>): Promise<void> {
    const { orderId } = job.data;

    const order = await this.validateAndRetrieveOrder(
      orderId,
      OrderStatus.PROCESSED,
    );
    if (!order) return;

    this.logger.log(
      `Processing order, attempt ${job.attemptsMade + 1} of ${job.opts.attempts}`,
      { orderId },
    );

    await this.finish(order);
  }

  executeAfterFail(job: Job<ProcessOrderJobPayload>, error: Error): Promise<void> {
    return this.guard.transaction(() => this._executeAfterFail(job, error));
  }

  private async _executeAfterFail(
    job: Job<ProcessOrderJobPayload>,
    error: Error,
  ): Promise<void> {
    const { orderId } = job.data;

    this.logger.error(
      `Failed to process order after all retries: ${error.message}`,
      { orderId },
    );

    try {
      await this.compensationLogic(orderId);
    } catch (e) {
      const err = ensureError(e);
      this.logger.error(
        `[CRITICAL] Compensation logic failed for processing order: ${err.message}`,
        { orderId },
      );
    }
  }

  private async compensationLogic(orderId: string) {
    const order = await this.orderRepository.findById(orderId, {
      relations: ['user'],
    });
    if (!order) {
      this.logger.log(`Order ${orderId} does not exist, skipping compensation`);
      return;
    }

    if (OrderTransitionPolicy.canTransition(order.status, OrderStatus.REFUNDED)) {
      // Payment was already captured — refund
      await this.outboxService.add(new RefundOrderJobPayload(orderId));
    } else {
      // Payment was never captured — just cancel
      await this.outboxService.add(new CancelOrderJobPayload(orderId));
    }

    // Notify the user about the failure
    const user = order.user;
    const message = await this.messages.notifications.orderProcessFailed(
      user.language,
    );
    await this.outboxService.add(new NotifyUserJobPayload(user.id, message));
  }

  private async finish(order: Order) {
    const { id: orderId } = order;

    await this.updateOrderWithLock(orderId, { status: OrderStatus.PROCESSED });

    // Notify the user
    const user = order.user;
    const message = await this.messages.notifications.orderProcessed(user.language);
    await this.outboxService.add(new NotifyUserJobPayload(user.id, message));

    this.logger.log(`Order moved to PROCESSED`, { orderId });
  }
}
