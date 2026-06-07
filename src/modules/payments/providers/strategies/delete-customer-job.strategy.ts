import { PAYMENTS_SERVICE } from '@/modules/payments/constants/payments.token';
import { CACHE_SERVICE } from '@/shared/modules/cache/constants/cache.token';
import { PAYMENT_KEY } from '@/shared/modules/cache/constants/payment.key';
import type { ICacheService } from '@/shared/modules/cache/interfaces/cache-service.interface';
import { DbGuardService } from '@/shared/modules/db-guard/db-guard.service';
import { OUTBOX_SERVICE } from '@/shared/modules/outbox/constants/outbox.token';
import type { IOutboxService } from '@/shared/modules/outbox/interfaces/outbox-service.interface';
import { DeleteCustomerJobPayload } from '@/shared/payloads/payments-job.payload';
import { UpdateUserCustomerIdJobPayload } from '@/shared/payloads/user-job.payload';
import { Inject, Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import type { IPaymentsService } from '../../interfaces/payments-service.interface';
import { BasePaymentJobStrategy } from './base-payment-job.strategy';

@Injectable()
export class DeleteCustomerJobStrategy extends BasePaymentJobStrategy<DeleteCustomerJobPayload> {
  constructor(
    @Inject(PAYMENTS_SERVICE)
    paymentsService: IPaymentsService,
    @Inject(CACHE_SERVICE) cacheService: ICacheService,
    @Inject(OUTBOX_SERVICE) outboxService: IOutboxService,
    guard: DbGuardService,
  ) {
    super(
      DeleteCustomerJobStrategy.name,
      paymentsService,
      cacheService,
      outboxService,
      guard,
    );
  }

  async execute(job: Job<DeleteCustomerJobPayload>): Promise<void> {
    const { userDto } = job.data;

    this.logger.log(
      `Deleting customer, attempt ${job.attemptsMade + 1} of ${job.opts.attempts}`,
      { userId: userDto.id },
    );

    await this.deleteCustomer(job.data);
    await this.outboxService.add(
      new UpdateUserCustomerIdJobPayload(userDto.id, null),
    );

    this.logger.log(`Customer deleted successfully for user ID: ${userDto.id}`, {
      userId: userDto.id,
    });
  }

  async executeAfterFail(
    job: Job<DeleteCustomerJobPayload>,
    error: Error,
  ): Promise<void> {
    const { userDto } = job.data;
    this.logger.error(
      `[CRITICAL] Failed to delete customer for user after all retries: ${error.message}`,
      { userId: userDto.id },
    );
  }

  private async deleteCustomer(data: DeleteCustomerJobPayload): Promise<void> {
    const { userDto } = data;
    await this.paymentsService.deleteCustomer(userDto.customerId);
  }

  idempotencyKey(id: string): string {
    return PAYMENT_KEY.IDEMPOTENCY('delete-customer', id);
  }
}
