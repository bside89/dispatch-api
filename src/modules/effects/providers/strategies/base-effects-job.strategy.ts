import { EffectsJobPayload } from '@/shared/payloads/effects-job.payload';
import { BaseJobStrategy } from '@/shared/providers/strategies/base-job.strategy';

export abstract class BaseEffectJobStrategy<
  T extends EffectsJobPayload,
> extends BaseJobStrategy<T> {}
