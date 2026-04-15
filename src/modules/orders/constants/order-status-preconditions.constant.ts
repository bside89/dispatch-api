import { OrderStatus } from '../enums/order-status.enum';

/**
 * Defines valid predecessor statuses for each target Order status.
 * Used both by the job strategies (async pipeline) and by Admin endpoints
 * (manual transitions) to enforce consistent state-machine rules.
 */
export const ORDER_STATUS_PRECONDITIONS: Record<OrderStatus, OrderStatus[]> = {
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
