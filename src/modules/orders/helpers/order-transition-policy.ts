import { OrderStatus } from '../enums/order-status.enum';

export class OrderTransitionPolicy {
  private static readonly PRECONDITIONS: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.PENDING]: [],
    [OrderStatus.PAID]: [OrderStatus.PENDING],
    [OrderStatus.PROCESSED]: [OrderStatus.PAID],
    [OrderStatus.SHIPPED]: [OrderStatus.PROCESSED],
    [OrderStatus.DELIVERED]: [OrderStatus.SHIPPED],
    [OrderStatus.CANCELED]: [
      OrderStatus.PENDING,
      OrderStatus.PAID,
      OrderStatus.PROCESSED,
    ],
    [OrderStatus.REFUNDED]: [
      OrderStatus.PAID,
      OrderStatus.PROCESSED,
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
    ],
  };

  static getPreconditions(targetStatus: OrderStatus): OrderStatus[] {
    return OrderTransitionPolicy.PRECONDITIONS[targetStatus];
  }

  static canTransition(
    currentStatus: OrderStatus,
    targetStatus: OrderStatus,
  ): boolean {
    return OrderTransitionPolicy.getPreconditions(targetStatus).includes(
      currentStatus,
    );
  }
}
