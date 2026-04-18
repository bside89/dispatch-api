import { Injectable, Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import { OrderStatus } from '../enums/order-status.enum';
import { RefundOrderJobPayload } from '../../../shared/payloads/order-job.payload';
import { NotifyUserJobPayload } from '@/shared/payloads/event-job.payload';
import { Transactional } from '@/shared/decorators/transactional.decorator';
import { OutboxType } from '@/shared/modules/outbox/enums/outbox-type.enum';
import { CACHE_SERVICE } from '../../../shared/modules/cache/constants/cache.tokens';
import type { ICacheService } from '../../../shared/modules/cache/interfaces/cache-service.interface';
import { OUTBOX_SERVICE } from '@/shared/modules/outbox/constants/outbox.tokens';
import type { IOutboxService } from '@/shared/modules/outbox/interfaces/outbox-service.interface';
import { ORDER_REPOSITORY } from '../constants/orders.tokens';
import type { IOrderRepository } from '../interfaces/order-repository.interface';
import { DataSource } from 'typeorm';
import { BaseOrderJobStrategy } from './base-order-job.strategy';
import Redlock from 'redlock';
import { delay } from '@/shared/helpers/functions';
import { OrderMessageFactory } from '../factories/order-message.factory';
import { Order } from '../entities/order.entity';

@Injectable()
export class RefundOrderJobStrategy extends BaseOrderJobStrategy<RefundOrderJobPayload> {
  constructor(
    @Inject(OUTBOX_SERVICE) private readonly outboxService: IOutboxService,
    private readonly messages: OrderMessageFactory,
    @Inject(CACHE_SERVICE) cacheService: ICacheService,
    @Inject(ORDER_REPOSITORY) orderRepository: IOrderRepository,
    dataSource: DataSource,
    redlock: Redlock,
  ) {
    super(
      RefundOrderJobStrategy.name,
      cacheService,
      orderRepository,
      dataSource,
      redlock,
    );
  }

  @Transactional()
  async execute(job: Job<RefundOrderJobPayload>): Promise<void> {
    const { orderId } = job.data;

    const order = await this.getAndValidate(orderId, OrderStatus.REFUNDED);
    if (!order) return;

    this.logger.log(
      `Refunding order, attempt ${job.attemptsMade + 1} of ${job.opts.attempts}`,
      { orderId },
    );

    await this.refundPayment(order);

    await this.finish(order);
  }

  @Transactional()
  async executeAfterFail(
    job: Job<RefundOrderJobPayload>,
    error: Error,
  ): Promise<void> {
    const { orderId } = job.data;

    this.logger.error(
      `[CRITICAL] Failed to refund order after all retries: ${error.message}`,
      { orderId },
    );
  }

  private async refundPayment(order: Order) {
    const { id: orderId } = order;

    // TODO: trigger Stripe PaymentIntent refund here
    await delay(1000);

    this.logger.log(`Refund OK`, { orderId });
  }

  private async finish(order: Order) {
    await this.updateOrderWithLock(order.id, { status: OrderStatus.REFUNDED });

    // Notify the user
    const user = order.user;
    const message = await this.messages.notifications.orderRefunded(user.language);
    await this.outboxService.add(
      OutboxType.EVENTS_NOTIFY_USER,
      new NotifyUserJobPayload(user.id, message),
    );

    this.logger.log(`Order moved to REFUNDED`, { orderId: order.id });
  }
}
