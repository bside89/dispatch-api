import { BaseJobHandlerFactory } from '@/shared/factories/base-job-handler.factory';
import { OutboxType } from '@/shared/modules/outbox/enums/outbox-type.enum';
import { BaseJobPayload } from '@/shared/payloads/base-job.payload';
import { BaseJobStrategy } from '@/shared/providers/strategies/base-job.strategy';
import { Injectable } from '@nestjs/common';
import { UpdateUserJobStrategy } from '../strategies/update-user-job.strategy';

@Injectable()
export class UserJobHandlerFactory extends BaseJobHandlerFactory {
  constructor(private readonly updateCustomerIdJobStrategy: UpdateUserJobStrategy) {
    super();
  }

  createHandler(jobType: string): BaseJobStrategy<BaseJobPayload> | null {
    const map: Record<string, BaseJobStrategy<BaseJobPayload>> = {
      [OutboxType.USER_UPDATE]: this.updateCustomerIdJobStrategy,
    };

    return map[jobType] ?? null;
  }
}
