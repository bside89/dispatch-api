import { PAYMENTS_SERVICE } from '@/modules/payments/constants/payments.token';
import { I18N_PAYMENTS } from '@/shared/constants/i18n';
import { CACHE_SERVICE } from '@/shared/modules/cache/constants/cache.token';
import { PAYMENT_KEY } from '@/shared/modules/cache/constants/payment.key';
import type { ICacheService } from '@/shared/modules/cache/interfaces/cache-service.interface';
import { DbGuardService } from '@/shared/modules/db-guard/db-guard.service';
import { OUTBOX_SERVICE } from '@/shared/modules/outbox/constants/outbox.token';
import type { IOutboxService } from '@/shared/modules/outbox/interfaces/outbox-service.interface';
import { CreateCustomerJobPayload } from '@/shared/payloads/payments-job.payload';
import { UpdateUserJobPayload } from '@/shared/payloads/user-job.payload';
import { template } from '@/shared/utils/functions.utils';
import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { Job } from 'bullmq';
import { CreateCustomerDto } from '../../dto/create-customer.dto';
import { CustomerResponseDto } from '../../dto/customer-response.dto';
import type { IPaymentsService } from '../../interfaces/payments-service.interface';
import { BasePaymentJobStrategy } from './base-payment-job.strategy';

@Injectable()
export class CreateCustomerJobStrategy extends BasePaymentJobStrategy<CreateCustomerJobPayload> {
  constructor(
    @Inject(PAYMENTS_SERVICE) paymentsService: IPaymentsService,
    @Inject(CACHE_SERVICE) cacheService: ICacheService,
    @Inject(OUTBOX_SERVICE) outboxService: IOutboxService,
    guard: DbGuardService,
  ) {
    super(
      CreateCustomerJobStrategy.name,
      paymentsService,
      cacheService,
      outboxService,
      guard,
    );
  }

  async execute(job: Job<CreateCustomerJobPayload>): Promise<void> {
    const { userDto } = job.data;

    this.logger.log(
      `Creating customer, attempt ${job.attemptsMade + 1} of ${job.opts.attempts}`,
      { userId: userDto.id },
    );

    const customer = await this.createCustomer(job.data);
    if (!customer || !customer.id) {
      throw new InternalServerErrorException(
        template(I18N_PAYMENTS.ERRORS.CREATE_CUSTOMER_FAILED),
      );
    }

    await this.outboxService.add(new UpdateUserJobPayload(userDto.id, customer.id));

    this.logger.log(`Customer created successfully with ID: ${customer.id}`, {
      userId: userDto.id,
    });
  }

  async executeAfterFail(
    job: Job<CreateCustomerJobPayload>,
    error: Error,
  ): Promise<void> {
    this.logger.error(
      `[CRITICAL] Failed to create customer for user after all retries: ${error.message}`,
      { userId: job.data.userDto.id },
    );
  }

  private async createCustomer(
    data: CreateCustomerJobPayload,
  ): Promise<CustomerResponseDto> {
    const dto = new CreateCustomerDto();

    dto.userId = data.userDto.id;
    dto.email = data.userDto.email;
    dto.name = data.userDto.name;

    const idempotencyKey = this.idempotencyKey(data.userDto.id);

    return this.paymentsService.createCustomer(dto, idempotencyKey);
  }

  idempotencyKey(id: string): string {
    return PAYMENT_KEY.IDEMPOTENCY('create-customer', id);
  }
}
