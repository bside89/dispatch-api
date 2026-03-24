import { Injectable } from '@nestjs/common';
import { ProcessOrderStrategy } from '../strategies/process-order.strategy';
import { NotificationStrategy } from '../strategies/notification.strategy';
import { CancelOrderStrategy } from '../strategies/cancel-order.strategy';
import { OrderJob } from '../enums/order-job.enum';
import { ShipOrderStrategy } from '../strategies/ship-order.strategy';
import { DeliverOrderStrategy } from '../strategies/deliver-order.strategy';

@Injectable()
export class JobHandlerFactory {
  constructor(
    private readonly processOrder: ProcessOrderStrategy,
    private readonly shipOrder: ShipOrderStrategy,
    private readonly deliverOrder: DeliverOrderStrategy,
    private readonly cancelOrder: CancelOrderStrategy,
    private readonly notification: NotificationStrategy,
  ) {}

  createHandler(jobType: string) {
    const map = {
      [OrderJob.PROCESS_ORDER]: this.processOrder,
      [OrderJob.SHIP_ORDER]: this.shipOrder,
      [OrderJob.DELIVER_ORDER]: this.deliverOrder,
      [OrderJob.CANCEL_ORDER]: this.cancelOrder,
      [OrderJob.NOTIFICATION_ORDER]: this.notification,
    };

    return map[jobType] || null;
  }
}
