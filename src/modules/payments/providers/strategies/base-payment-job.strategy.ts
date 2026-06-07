import type { IOutboxService } from '@/shared/modules/outbox/interfaces/outbox-service.interface';
import type { ICacheService } from '@/shared/modules/cache/interfaces/cache-service.interface';
import { DbGuardService } from '@/shared/modules/db-guard/db-guard.service';
import { PaymentJobPayload } from '@/shared/payloads/payments-job.payload';
import { BaseJobStrategy } from '@/shared/strategies/base-job.strategy';
import { IPaymentsService } from '../../interfaces/payments-service.interface';

export abstract class BasePaymentJobStrategy<
  T extends PaymentJobPayload,
> extends BaseJobStrategy<T> {
  constructor(
    jobName: string,
    protected readonly paymentsService: IPaymentsService,
    protected readonly cacheService: ICacheService,
    protected readonly outboxService: IOutboxService,
    protected readonly guard: DbGuardService,
  ) {
    super(jobName);
  }

  abstract idempotencyKey(id: string): string;
}
