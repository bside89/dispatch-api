import { Injectable } from '@nestjs/common';
import { OrderStatus } from '../enums/order-status.enum';

@Injectable()
export class OrderTransitionPolicy {
  private readonly PRECONDITIONS: Record<OrderStatus, OrderStatus[]> = {
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

  getPreconditions(targetStatus: OrderStatus): OrderStatus[] {
    return this.PRECONDITIONS[targetStatus];
  }

  canTransition(currentStatus: OrderStatus, targetStatus: OrderStatus): boolean {
    return this.getPreconditions(targetStatus).includes(currentStatus);
  }
}
