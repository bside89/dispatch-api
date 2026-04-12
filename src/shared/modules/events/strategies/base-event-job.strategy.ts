import { EventJobPayload } from '@/shared/payloads/event-job.payload';
import { BaseJobStrategy } from '@/shared/strategies/base-job.strategy';

export abstract class BaseEventJobStrategy<
  T extends EventJobPayload,
> extends BaseJobStrategy<T> {}
