import { OrderTransitionPolicy } from './order-transition-policy';
import { OrderStatus } from '../enums/order-status.enum';

describe('OrderTransitionPolicy', () => {
  it('should expose the expected valid predecessors', () => {
    expect(OrderTransitionPolicy.getPreconditions(OrderStatus.SHIPPED)).toEqual([
      OrderStatus.PROCESSED,
    ]);
    expect(OrderTransitionPolicy.getPreconditions(OrderStatus.CANCELED)).toEqual([
      OrderStatus.PENDING,
      OrderStatus.PAID,
      OrderStatus.PROCESSED,
    ]);
  });

  it('should validate allowed transitions consistently', () => {
    expect(
      OrderTransitionPolicy.canTransition(
        OrderStatus.PROCESSED,
        OrderStatus.SHIPPED,
      ),
    ).toBe(true);
    expect(
      OrderTransitionPolicy.canTransition(OrderStatus.PENDING, OrderStatus.SHIPPED),
    ).toBe(false);
  });
});
