import { Injectable } from '@nestjs/common';

import { OutboxType as EventJob } from '@/shared/modules/outbox/enums/outbox-type.enum';
import { BaseJobStrategy } from '@/shared/strategies/base-job.strategy';
import { BaseJobPayload } from '@/shared/payloads/base-job.payload';
import { NotifyUserJobStrategy } from '../strategies';
import { BaseJobHandlerFactory } from '@/shared/factories/base-job-handler.factory';

@Injectable()
export class EventJobHandlerFactory extends BaseJobHandlerFactory {
  constructor(private readonly notifyUserJobStrategy: NotifyUserJobStrategy) {
    super();
  }

  createHandler(jobType: string): BaseJobStrategy<BaseJobPayload> | null {
    const map: Record<string, BaseJobStrategy<BaseJobPayload>> = {
      [EventJob.EVENTS_NOTIFY_USER]: this.notifyUserJobStrategy,
    };

    return map[jobType] ?? null;
  }
}
