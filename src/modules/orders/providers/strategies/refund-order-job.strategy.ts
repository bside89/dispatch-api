import { PAYMENTS_SERVICE } from '@/modules/payments/constants/payments.token';
import type { IPaymentsService } from '@/modules/payments/interfaces/payments-service.interface';
import { PAYMENT_KEY } from '@/shared/modules/cache/constants/payment.key';
import { DbGuardService } from '@/shared/modules/db-guard/db-guard.service';
import { OUTBOX_SERVICE } from '@/shared/modules/outbox/constants/outbox.token';
import type { IOutboxService } from '@/shared/modules/outbox/interfaces/outbox-service.interface';
import { NotifyUserJobPayload } from '@/shared/payloads/effects-job.payload';
import { Inject, Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { CACHE_SERVICE } from '../../../../shared/modules/cache/constants/cache.token';
import type { ICacheService } from '../../../../shared/modules/cache/interfaces/cache-service.interface';
import { RefundOrderJobPayload } from '../../../../shared/payloads/orders-job.payload';
import { ORDER_REPOSITORY } from '../../constants/orders.token';
import { Order } from '../../entities/order.entity';
import { OrderStatus } from '../../enums/order-status.enum';
import type { IOrderRepository } from '../../interfaces/order-repository.interface';
import { OrderMessageFactory } from '../factories/order-message.factory';
import { BaseOrderJobStrategy } from './base-order-job.strategy';

@Injectable()
export class RefundOrderJobStrategy extends BaseOrderJobStrategy<RefundOrderJobPayload> {
  constructor(
    private readonly messages: OrderMessageFactory,
    @Inject(PAYMENTS_SERVICE)
    private readonly paymentsService: IPaymentsService,
    @Inject(OUTBOX_SERVICE) private readonly outboxService: IOutboxService,
    @Inject(CACHE_SERVICE) cacheService: ICacheService,
    @Inject(ORDER_REPOSITORY) orderRepository: IOrderRepository,
    guard: DbGuardService,
  ) {
    super(RefundOrderJobStrategy.name, cacheService, orderRepository, guard);
  }

  execute(job: Job<RefundOrderJobPayload>): Promise<void> {
    return this.guard.transaction(() => this._execute(job));
  }

  private async _execute(job: Job<RefundOrderJobPayload>): Promise<void> {
    const { orderId } = job.data;

    const order = await this.validateAndRetrieveOrder(orderId, OrderStatus.REFUNDED);
    if (!order) return;

    this.logger.log(
      `Refunding order, attempt ${job.attemptsMade + 1} of ${job.opts.attempts}`,
      { orderId },
    );

    await this.refundPayment(order);

    await this.finish(order);
  }

  executeAfterFail(job: Job<RefundOrderJobPayload>, error: Error): Promise<void> {
    return this.guard.transaction(() => this._executeAfterFail(job, error));
  }

  private async _executeAfterFail(
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

    const idempotencyKey = PAYMENT_KEY.IDEMPOTENCY('refund-order', orderId);
    await this.paymentsService.createRefund(
      {
        orderId,
        amount: order.total,
      },
      idempotencyKey,
    );

    this.logger.log(`Payment refunded successfully`, { orderId });
  }

  private async finish(order: Order) {
    await this.updateOrderWithLock(order.id, { status: OrderStatus.REFUNDED });

    // Notify the user
    const user = order.user;
    const message = await this.messages.notifications.orderRefunded(user.language);
    await this.outboxService.add(new NotifyUserJobPayload(user.id, message));

    this.logger.log(`Order moved to REFUNDED`, { orderId: order.id });
  }
}
