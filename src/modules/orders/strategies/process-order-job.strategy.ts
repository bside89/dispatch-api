import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { OrderStatus } from '../enums/order-status.enum';
import {
  CancelOrderJobPayload,
  ProcessOrderJobPayload,
  RefundOrderJobPayload,
} from '../../../shared/payloads/order-job.payload';
import { NotifyUserJobPayload } from '@/shared/payloads/event-job.payload';
import { ensureError } from '../../../shared/helpers/functions';
import { Transactional } from '@/shared/decorators/transactional.decorator';
import { OutboxType } from '@/shared/modules/outbox/enums/outbox-type.enum';
import { CacheService } from '../../../shared/modules/cache/cache.service';
import { OutboxService } from '@/shared/modules/outbox/outbox.service';
import { OrderRepository } from '../repositories/order.repository';
import { DataSource } from 'typeorm';
import { BaseOrderJobStrategy } from './base-order-job.strategy';
import Redlock from 'redlock';
import { OrderMessageFactory } from '../factories/order-message.factory';
import { Order } from '../entities/order.entity';

@Injectable()
export class ProcessOrderJobStrategy extends BaseOrderJobStrategy<ProcessOrderJobPayload> {
  constructor(
    private readonly outboxService: OutboxService,
    private readonly messages: OrderMessageFactory,
    cacheService: CacheService,
    orderRepository: OrderRepository,
    dataSource: DataSource,
    redlock: Redlock,
  ) {
    super(
      ProcessOrderJobStrategy.name,
      cacheService,
      orderRepository,
      dataSource,
      redlock,
    );
  }

  @Transactional()
  async execute(job: Job<ProcessOrderJobPayload>): Promise<void> {
    const { orderId } = job.data;

    const order = await this.getAndValidate(orderId, OrderStatus.PROCESSED);
    if (!order) return;

    this.logger.log(
      `Processing order, attempt ${job.attemptsMade + 1} of ${job.opts.attempts}`,
      { orderId },
    );

    await this.finish(order);
  }

  @Transactional()
  async executeAfterFail(
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

    const refundStatuses = [
      OrderStatus.PAID,
      OrderStatus.PROCESSED,
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
    ];

    if (refundStatuses.includes(order.status)) {
      // Payment was already captured — refund
      await this.outboxService.add(
        OutboxType.ORDER_REFUND,
        new RefundOrderJobPayload(orderId),
      );
    } else {
      // Payment was never captured — just cancel
      await this.outboxService.add(
        OutboxType.ORDER_CANCEL,
        new CancelOrderJobPayload(orderId),
      );
    }

    // Notify the user about the failure
    const user = order.user;
    const message = await this.messages.notifications.orderProcessFailed(
      user.language,
    );
    await this.outboxService.add(
      OutboxType.EVENTS_NOTIFY_USER,
      new NotifyUserJobPayload(user.id, message),
    );
  }

  private async finish(order: Order) {
    const { id: orderId } = order;

    await this.updateOrderWithLock(orderId, { status: OrderStatus.PROCESSED });

    // Notify the user
    const user = order.user;
    const message = await this.messages.notifications.orderProcessed(user.language);
    await this.outboxService.add(
      OutboxType.EVENTS_NOTIFY_USER,
      new NotifyUserJobPayload(user.id, message),
    );

    this.logger.log(`Order moved to PROCESSED`, { orderId });
  }
}
