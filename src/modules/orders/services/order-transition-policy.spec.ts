import { OrderTransitionPolicy } from './order-transition-policy.service';
import { OrderStatus } from '../enums/order-status.enum';

describe('OrderTransitionPolicy', () => {
  it('should expose the expected valid predecessors', () => {
    const policy = new OrderTransitionPolicy();

    expect(policy.getPreconditions(OrderStatus.SHIPPED)).toEqual([
      OrderStatus.PROCESSED,
    ]);
    expect(policy.getPreconditions(OrderStatus.CANCELED)).toEqual([
      OrderStatus.PENDING,
      OrderStatus.PAID,
      OrderStatus.PROCESSED,
    ]);
  });

  it('should validate allowed transitions consistently', () => {
    const policy = new OrderTransitionPolicy();

    expect(policy.canTransition(OrderStatus.PROCESSED, OrderStatus.SHIPPED)).toBe(
      true,
    );
    expect(policy.canTransition(OrderStatus.PENDING, OrderStatus.SHIPPED)).toBe(
      false,
    );
  });
});
