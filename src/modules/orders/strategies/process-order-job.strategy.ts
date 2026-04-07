import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { OrderStatus } from '../enums/order-status.enum';
import {
  CancelOrderJobPayload,
  ProcessOrderJobPayload,
  RefundOrderJobPayload,
  ShipOrderJobPayload,
} from '../../../shared/payloads/order-job.payload';
import { NotifyUserJobPayload } from '@/shared/payloads/event-job.payload';
import { delay, ensureError } from '../../../shared/helpers/functions';
import { Transactional } from '@/shared/decorators/transactional.decorator';
import { OutboxType } from '@/shared/modules/outbox/enums/outbox-type.enum';
import { CacheService } from '../../../shared/modules/cache/cache.service';
import { OutboxService } from '@/shared/modules/outbox/outbox.service';
import { OrderRepository } from '../repositories/order.repository';
import { DataSource } from 'typeorm';
import { BaseOrderJobStrategy } from './base-order-job.strategy';
import Redlock from 'redlock';
import { Order } from '../entities/order.entity';

@Injectable()
export class ProcessOrderJobStrategy extends BaseOrderJobStrategy<ProcessOrderJobPayload> {
  constructor(
    protected readonly cacheService: CacheService,
    protected readonly outboxService: OutboxService,
    protected readonly orderRepository: OrderRepository,
    protected readonly dataSource: DataSource, // Used in @Transactional()
    protected readonly redlock: Redlock, // Used in @UseLock()
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

    const order = await this.getAndValidate(orderId, OrderStatus.PAID);
    if (!order) return;

    this.logger.log(
      `Processing order, attempt ${job.attemptsMade + 1} of ${job.opts.attempts}`,
      { orderId },
    );

    if (!order.paid) {
      await this.processPayment(job.data, order);

      await this.lockAndUpdateOrder(orderId, { paid: true });
    }

    await this.finish(job.data);
  }

  @Transactional()
  async executeAfterFail(
    job: Job<ProcessOrderJobPayload>,
    error: Error,
  ): Promise<void> {
    const { orderId } = job.data;

    this.logger.error(
      `Failed to process payment for order after all retries: ${error.message}`,
      { orderId },
    );

    try {
      await this.compensationLogic(job.data, error);
    } catch (e) {
      const error = ensureError(e);

      this.logger.error(
        `[CRITICAL] Compensation logic failed for processing order: ${error.message}`,
        { orderId },
      );
    }
  }

  private async compensationLogic(data: ProcessOrderJobPayload, error: Error) {
    const { orderId, userId, userName } = data;

    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      this.logger.log(`Order ${orderId} does not exist, skipping compensation`);
      return;
    }
    if (order.paid) {
      // Refund job
      await this.outboxService.add(
        OutboxType.ORDER_REFUND,
        new RefundOrderJobPayload(userId, orderId, userName),
      );
    } else {
      // Cancel job
      await this.outboxService.add(
        OutboxType.ORDER_CANCEL,
        new CancelOrderJobPayload(userId, orderId, userName),
      );
    }

    // Notify the user about the failure
    await this.outboxService.add(
      OutboxType.EVENTS_NOTIFY_USER,
      new NotifyUserJobPayload(
        userId,
        userName,
        `<To user ${userName}>: Your order with id ${orderId} has failed to process.` +
          `Reason: ${error.message}`,
      ),
    );
  }

  private async processPayment(data: ProcessOrderJobPayload, order: Order) {
    if (Math.random() < 0.1) throw new Error('Random payment error');
    await delay(2000);
    this.logger.log(`Payment OK. Total: R$ ${(order.total / 100).toFixed(2)}`, {
      orderId: data.orderId,
    });
  }

  private async finish(data: ProcessOrderJobPayload) {
    const { orderId, userId, userName } = data;

    await this.lockAndUpdateOrder(orderId, { status: OrderStatus.PAID });

    // Notify the user
    await this.outboxService.add(
      OutboxType.EVENTS_NOTIFY_USER,
      new NotifyUserJobPayload(
        userId,
        userName,
        `<To user ${userName}>: Your order with id ${orderId} has been paid successfully.`,
      ),
    );

    // Ship job
    await this.outboxService.add(
      OutboxType.ORDER_SHIP,
      new ShipOrderJobPayload(userId, orderId, userName),
    );

    this.logger.log(`Order moved to PAID`, { orderId });
  }
}
