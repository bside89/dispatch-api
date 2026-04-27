import { Injectable } from '@nestjs/common';

import { OutboxType as EffectsJob } from '@/shared/modules/outbox/enums/outbox-type.enum';
import { BaseJobStrategy } from '@/shared/strategies/base-job.strategy';
import { BaseJobPayload } from '@/shared/payloads/base-job.payload';
import { NotifyUserJobStrategy } from '../strategies';
import { BaseJobHandlerFactory } from '@/shared/factories/base-job-handler.factory';

@Injectable()
export class EffectJobHandlerFactory extends BaseJobHandlerFactory {
  constructor(private readonly notifyUserEffectStrategy: NotifyUserJobStrategy) {
    super();
  }

  createHandler(jobType: string): BaseJobStrategy<BaseJobPayload> | null {
    const map: Record<string, BaseJobStrategy<BaseJobPayload>> = {
      [EffectsJob.EFFECTS_NOTIFY_USER]: this.notifyUserEffectStrategy,
    };

    return map[jobType] ?? null;
  }
}
