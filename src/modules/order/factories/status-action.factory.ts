import {
  CancelledStatusAction,
  ConfirmedStatusAction,
  DeliveredStatusAction,
  ProcessingStatusAction,
  RefundedStatusAction,
  ShippedStatusAction,
  StatusAction,
} from '../actions/order-status.action';
import { OrderStatus } from '../enums/order-status.enum';

export class StatusActionFactory {
  createAction(status: OrderStatus): StatusAction | null {
    const map = {
      [OrderStatus.CONFIRMED]: new ConfirmedStatusAction(),
      [OrderStatus.PROCESSING]: new ProcessingStatusAction(),
      [OrderStatus.SHIPPED]: new ShippedStatusAction(),
      [OrderStatus.DELIVERED]: new DeliveredStatusAction(),
      [OrderStatus.CANCELLED]: new CancelledStatusAction(),
      [OrderStatus.REFUNDED]: new RefundedStatusAction(),
    };

    return map[status] || null;
  }
}
