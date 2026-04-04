import { Injectable } from '@nestjs/common';

import { OutboxType as OrderJob } from '@/shared/modules/outbox/enums/outbox-type.enum';
import { BaseJobStrategy } from '@/shared/strategies/base-job.strategy';
import { BaseJobPayload } from '@/shared/jobs/base-job.payload';
import {
  CancelOrderJobStrategy,
  DeliverOrderJobStrategy,
  ProcessOrderJobStrategy,
  ShipOrderJobStrategy,
} from '../strategies';

@Injectable()
export class OrderJobHandlerFactory {
  constructor(
    private readonly processOrderJobStrategy: ProcessOrderJobStrategy,
    private readonly shipOrderJobStrategy: ShipOrderJobStrategy,
    private readonly deliverOrderJobStrategy: DeliverOrderJobStrategy,
    private readonly cancelOrderJobStrategy: CancelOrderJobStrategy,
  ) {}

  createHandler(jobType: string): BaseJobStrategy<BaseJobPayload> | null {
    const map: Record<string, BaseJobStrategy<BaseJobPayload>> = {
      [OrderJob.ORDER_PROCESS]: this.processOrderJobStrategy,
      [OrderJob.ORDER_SHIP]: this.shipOrderJobStrategy,
      [OrderJob.ORDER_DELIVER]: this.deliverOrderJobStrategy,
      [OrderJob.ORDER_CANCEL]: this.cancelOrderJobStrategy,
    };

    return map[jobType] ?? null;
  }
}
