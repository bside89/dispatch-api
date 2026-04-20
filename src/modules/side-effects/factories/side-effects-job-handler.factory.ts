import { Injectable } from '@nestjs/common';

import { OutboxType as SideEffectsJob } from '@/shared/modules/outbox/enums/outbox-type.enum';
import { BaseJobStrategy } from '@/shared/strategies/base-job.strategy';
import { BaseJobPayload } from '@/shared/payloads/base-job.payload';
import { NotifyUserJobStrategy } from '../strategies';
import { BaseJobHandlerFactory } from '@/shared/factories/base-job-handler.factory';

@Injectable()
export class SideEffectJobHandlerFactory extends BaseJobHandlerFactory {
  constructor(private readonly notifyUserSideEffectStrategy: NotifyUserJobStrategy) {
    super();
  }

  createHandler(jobType: string): BaseJobStrategy<BaseJobPayload> | null {
    const map: Record<string, BaseJobStrategy<BaseJobPayload>> = {
      [SideEffectsJob.SIDE_EFFECTS_NOTIFY_USER]: this.notifyUserSideEffectStrategy,
    };

    return map[jobType] ?? null;
  }
}
