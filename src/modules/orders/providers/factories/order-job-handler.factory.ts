import { Injectable } from '@nestjs/common';

import { OutboxType as OrderJob } from '@/shared/modules/outbox/enums/outbox-type.enum';
import { BaseJobStrategy } from '@/shared/strategies/base-job.strategy';
import { BaseJobPayload } from '@/shared/payloads/base-job.payload';
import {
  CancelOrderJobStrategy,
  ProcessOrderJobStrategy,
  RefundOrderJobStrategy,
} from '../strategies';
import { BaseJobHandlerFactory } from '@/shared/factories/base-job-handler.factory';

@Injectable()
export class OrderJobHandlerFactory extends BaseJobHandlerFactory {
  constructor(
    private readonly processOrderJobStrategy: ProcessOrderJobStrategy,
    private readonly cancelOrderJobStrategy: CancelOrderJobStrategy,
    private readonly refundOrderJobStrategy: RefundOrderJobStrategy,
  ) {
    super();
  }

  createHandler(jobType: string): BaseJobStrategy<BaseJobPayload> | null {
    const map: Record<string, BaseJobStrategy<BaseJobPayload>> = {
      [OrderJob.ORDER_PROCESS]: this.processOrderJobStrategy,
      [OrderJob.ORDER_CANCEL]: this.cancelOrderJobStrategy,
      [OrderJob.ORDER_REFUND]: this.refundOrderJobStrategy,
    };

    return map[jobType] ?? null;
  }
}
