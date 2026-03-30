import { Injectable } from '@nestjs/common';
import { ProcessOrderStrategy } from '../strategies/process-order.strategy';
import { NotificationStrategy } from '../../../shared/modules/events/strategies/notification.strategy';
import { CancelOrderStrategy } from '../strategies/cancel-order.strategy';
import { ShipOrderStrategy } from '../strategies/ship-order.strategy';
import { DeliverOrderStrategy } from '../strategies/deliver-order.strategy';
import { OutboxType as OrderJob } from '@/shared/modules/outbox/enums/outbox-type.enum';

@Injectable()
export class OrderJobHandlerFactory {
  constructor(
    private readonly processOrder: ProcessOrderStrategy,
    private readonly shipOrder: ShipOrderStrategy,
    private readonly deliverOrder: DeliverOrderStrategy,
    private readonly cancelOrder: CancelOrderStrategy,
    private readonly notification: NotificationStrategy,
  ) {}

  createHandler(jobType: string) {
    const map = {
      [OrderJob.ORDER_PROCESS]: this.processOrder,
      [OrderJob.ORDER_SHIP]: this.shipOrder,
      [OrderJob.ORDER_DELIVER]: this.deliverOrder,
      [OrderJob.ORDER_CANCEL]: this.cancelOrder,
      [OrderJob.ORDER_NOTIFICATION]: this.notification,
    };

    return map[jobType] || null;
  }
}
