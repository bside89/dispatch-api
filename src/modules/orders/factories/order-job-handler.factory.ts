import { Injectable } from '@nestjs/common';
import { ProcessOrderJobStrategy } from '../strategies/process-order-job.strategy';
import { CancelOrderJobStrategy } from '../strategies/cancel-order-job.strategy';
import { ShipOrderJobStrategy } from '../strategies/ship-order-job.strategy';
import { DeliverOrderJobStrategy } from '../strategies/deliver-order-job.strategy';
import { OutboxType as OrderJob } from '@/shared/modules/outbox/enums/outbox-type.enum';
import { BaseJobStrategy } from '@/shared/strategies/base-job.strategy';
import { BaseJobPayload } from '@/shared/jobs/base-job.payload';

@Injectable()
export class OrderJobHandlerFactory {
  constructor(
    private readonly processPaymentOrder: ProcessOrderJobStrategy,
    private readonly shipOrder: ShipOrderJobStrategy,
    private readonly deliverOrder: DeliverOrderJobStrategy,
    private readonly cancelOrder: CancelOrderJobStrategy,
  ) {}

  createHandler(jobType: string): BaseJobStrategy<BaseJobPayload> | null {
    const map: Record<string, BaseJobStrategy<BaseJobPayload>> = {
      [OrderJob.ORDER_PROCESS]: this.processPaymentOrder,
      [OrderJob.ORDER_SHIP]: this.shipOrder,
      [OrderJob.ORDER_DELIVER]: this.deliverOrder,
      [OrderJob.ORDER_CANCEL]: this.cancelOrder,
    };

    return map[jobType] ?? null;
  }
}
