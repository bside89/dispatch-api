import { OrderStatus } from '../enums/order-status.enum';
import {
  StatusAction,
  ConfirmedStatusAction,
  ShippedStatusAction,
  DeliveredStatusAction,
  CancelledStatusAction,
} from '../strategies/status-actions.strategy';

export class StatusActionFactory {
  private static readonly actions = new Map<string, StatusAction>([
    [OrderStatus.CONFIRMED, new ConfirmedStatusAction()],
    [OrderStatus.SHIPPED, new ShippedStatusAction()],
    [OrderStatus.DELIVERED, new DeliveredStatusAction()],
    [OrderStatus.CANCELLED, new CancelledStatusAction()],
  ]);

  static createAction(status: string): StatusAction | null {
    return this.actions.get(status) || null;
  }

  static getSupportedStatuses(): string[] {
    return Array.from(this.actions.keys());
  }

  static registerAction(status: string, action: StatusAction): void {
    this.actions.set(status, action);
  }
}
