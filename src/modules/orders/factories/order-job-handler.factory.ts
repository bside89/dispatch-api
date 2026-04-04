import { Injectable } from '@nestjs/common';
import { ProcessPaymentOrderStrategy } from '../strategies/process-payment-order.strategy';
import { CancelOrderStrategy } from '../strategies/cancel-order.strategy';
import { ShipOrderStrategy } from '../strategies/ship-order.strategy';
import { DeliverOrderStrategy } from '../strategies/deliver-order.strategy';
import { OutboxType as OrderJob } from '@/shared/modules/outbox/enums/outbox-type.enum';
import { BaseJobStrategy } from '@/shared/strategies/base-job.strategy';
import { BaseJobPayload } from '@/shared/jobs/base-job.payload';

@Injectable()
export class OrderJobHandlerFactory {
  constructor(
    private readonly processPaymentOrder: ProcessPaymentOrderStrategy,
    private readonly shipOrder: ShipOrderStrategy,
    private readonly deliverOrder: DeliverOrderStrategy,
    private readonly cancelOrder: CancelOrderStrategy,
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
