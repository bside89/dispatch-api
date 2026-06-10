import { Injectable } from '@nestjs/common';

import { BaseJobHandlerFactory } from '@/shared/factories/base-job-handler.factory';
import { OutboxType as EffectsJob } from '@/shared/modules/outbox/enums/outbox-type.enum';
import { BaseJobPayload } from '@/shared/payloads/base-job.payload';
import { BaseJobStrategy } from '@/shared/providers/strategies/base-job.strategy';
import { NotifyUserJobStrategy } from '../strategies';

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
