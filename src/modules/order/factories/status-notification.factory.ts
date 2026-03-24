import { Injectable } from '@nestjs/common';
import {
  CancelledStatusNotificationStrategy,
  ConfirmedStatusNotificationStrategy,
  DeliveredStatusNotificationStrategy,
  ProcessingStatusNotificationStrategy,
  RefundedStatusNotificationStrategy,
  ShippedStatusNotificationStrategy,
  StatusNotificationStrategy,
} from '../strategies/all-notifications.strategy';
import { OrderStatus } from '../enums/order-status.enum';

@Injectable()
export class StatusNotificationFactory {
  createNotification(status: OrderStatus): StatusNotificationStrategy | null {
    const map = {
      [OrderStatus.CONFIRMED]: new ConfirmedStatusNotificationStrategy(),
      [OrderStatus.PROCESSED]: new ProcessingStatusNotificationStrategy(),
      [OrderStatus.SHIPPED]: new ShippedStatusNotificationStrategy(),
      [OrderStatus.DELIVERED]: new DeliveredStatusNotificationStrategy(),
      [OrderStatus.CANCELLED]: new CancelledStatusNotificationStrategy(),
      [OrderStatus.REFUNDED]: new RefundedStatusNotificationStrategy(),
    };

    return map[status] || null;
  }
}
