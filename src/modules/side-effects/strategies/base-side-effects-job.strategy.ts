import { SideEffectsJobPayload } from '@/shared/payloads/side-effects-job.payload';
import { BaseJobStrategy } from '@/shared/strategies/base-job.strategy';

export abstract class BaseSideEffectJobStrategy<
  T extends SideEffectsJobPayload,
> extends BaseJobStrategy<T> {}
