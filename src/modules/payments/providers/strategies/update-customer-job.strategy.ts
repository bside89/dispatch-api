import { PAYMENTS_SERVICE } from '@/modules/payments/constants/payments.token';
import { I18N_PAYMENTS } from '@/shared/constants/i18n';
import { CACHE_SERVICE } from '@/shared/modules/cache/constants/cache.token';
import { PAYMENT_KEY } from '@/shared/modules/cache/constants/payment.key';
import type { ICacheService } from '@/shared/modules/cache/interfaces/cache-service.interface';
import { DbGuardService } from '@/shared/modules/db-guard/db-guard.service';
import { OUTBOX_SERVICE } from '@/shared/modules/outbox/constants/outbox.token';
import type { IOutboxService } from '@/shared/modules/outbox/interfaces/outbox-service.interface';
import { UpdateCustomerJobPayload } from '@/shared/payloads/payments-job.payload';
import { template } from '@/shared/utils/functions.utils';
import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { Job } from 'bullmq';
import { CustomerResponseDto } from '../../dto/customer-response.dto';
import { UpdateCustomerDto } from '../../dto/update-customer.dto';
import type { IPaymentsService } from '../../interfaces/payments-service.interface';
import { BasePaymentJobStrategy } from './base-payment-job.strategy';

@Injectable()
export class UpdateCustomerJobStrategy extends BasePaymentJobStrategy<UpdateCustomerJobPayload> {
  constructor(
    @Inject(PAYMENTS_SERVICE)
    paymentsService: IPaymentsService,
    @Inject(CACHE_SERVICE) cacheService: ICacheService,
    @Inject(OUTBOX_SERVICE) outboxService: IOutboxService,
    guard: DbGuardService,
  ) {
    super(
      UpdateCustomerJobStrategy.name,
      paymentsService,
      cacheService,
      outboxService,
      guard,
    );
  }

  async execute(job: Job<UpdateCustomerJobPayload>): Promise<void> {
    const { userDto } = job.data;

    this.logger.log(
      `Updating customer, attempt ${job.attemptsMade + 1} of ${job.opts.attempts}`,
      { userId: userDto.id },
    );

    const customer = await this.updateCustomer(job.data);
    if (!customer || !customer.id) {
      throw new InternalServerErrorException(
        template(I18N_PAYMENTS.ERRORS.UPDATE_CUSTOMER_FAILED),
      );
    }

    this.logger.log(`Customer updated successfully with ID: ${customer.id}`, {
      userId: userDto.id,
    });
  }

  async executeAfterFail(
    job: Job<UpdateCustomerJobPayload>,
    error: Error,
  ): Promise<void> {
    const { userDto } = job.data;
    this.logger.error(
      `[CRITICAL] Failed to update customer for user after all retries: ${error.message}`,
      { userId: userDto.id },
    );
  }

  private async updateCustomer(
    data: UpdateCustomerJobPayload,
  ): Promise<CustomerResponseDto> {
    const { userDto } = data;

    const dto = new UpdateCustomerDto();
    dto.userId = userDto.id;
    dto.email = userDto.email;
    dto.name = userDto.name;

    return this.paymentsService.updateCustomer(dto);
  }

  idempotencyKey(id: string): string {
    return PAYMENT_KEY.IDEMPOTENCY('update-customer', id);
  }
}
