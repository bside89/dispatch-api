import { BaseJobHandlerFactory } from '@/shared/factories/base-job-handler.factory';
import { OutboxType } from '@/shared/modules/outbox/enums/outbox-type.enum';
import { BaseJobPayload } from '@/shared/payloads/base-job.payload';
import { BaseJobStrategy } from '@/shared/strategies/base-job.strategy';
import { Injectable } from '@nestjs/common';
import { UpdateUserCustomerIdJobStrategy } from '../strategies/update-user-customer-id-job.strategy';

@Injectable()
export class UserJobHandlerFactory extends BaseJobHandlerFactory {
  constructor(
    private readonly updateCustomerIdJobStrategy: UpdateUserCustomerIdJobStrategy,
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
