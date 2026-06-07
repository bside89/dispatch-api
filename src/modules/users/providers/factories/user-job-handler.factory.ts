import { BaseJobPayload } from '@/shared/payloads/base-job.payload';
import { BaseJobHandlerFactory } from '@/shared/factories/base-job-handler.factory';
import { BaseJobStrategy } from '@/shared/strategies/base-job.strategy';
import { OutboxType } from '@/shared/modules/outbox/enums/outbox-type.enum';
import { Injectable } from '@nestjs/common';
import { UpdateCustomerIdJobStrategy } from '../strategies/update-customer-id-job.strategy';

@Injectable()
export class UserJobHandlerFactory extends BaseJobHandlerFactory {
  constructor(
    private readonly updateCustomerIdJobStrategy: UpdateCustomerIdJobStrategy,
  ) {
    super();
  }

  createHandler(jobType: string): BaseJobStrategy<BaseJobPayload> | null {
    const map: Record<string, BaseJobStrategy<BaseJobPayload>> = {
      [OutboxType.USER_UPDATE_CUSTOMER_ID]: this.updateCustomerIdJobStrategy,
    };

    return map[jobType] ?? null;
  }
}
