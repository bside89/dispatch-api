import { Injectable } from '@nestjs/common';

import { BaseJobHandlerFactory } from '@/shared/factories/base-job-handler.factory';
import { OutboxType as PaymentJob } from '@/shared/modules/outbox/enums/outbox-type.enum';
import { BaseJobPayload } from '@/shared/payloads/base-job.payload';
import { BaseJobStrategy } from '@/shared/providers/strategies/base-job.strategy';
import {
  CreateCustomerJobStrategy,
  DeleteCustomerJobStrategy,
  UpdateCustomerJobStrategy,
} from '../strategies';

@Injectable()
export class PaymentJobHandlerFactory extends BaseJobHandlerFactory {
  constructor(
    private readonly createCustomerJobStrategy: CreateCustomerJobStrategy,
    private readonly updateCustomerJobStrategy: UpdateCustomerJobStrategy,
    private readonly deleteCustomerJobStrategy: DeleteCustomerJobStrategy,
  ) {
    super();
  }

  createHandler(jobType: string): BaseJobStrategy<BaseJobPayload> | null {
    const map: Record<string, BaseJobStrategy<BaseJobPayload>> = {
      [PaymentJob.PAYMENT_CREATE_CUSTOMER]: this.createCustomerJobStrategy,
      [PaymentJob.PAYMENT_UPDATE_CUSTOMER]: this.updateCustomerJobStrategy,
      [PaymentJob.PAYMENT_DELETE_CUSTOMER]: this.deleteCustomerJobStrategy,
    };

    return map[jobType] ?? null;
  }
}
