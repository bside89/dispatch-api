export enum NotificationEvent {
  AUTH_LOGIN = 'auth.login',
  ORDER_CREATED = 'order.created',
  ORDER_FAILED_UPON_CREATING = 'order.failed-upon-creating',
  ORDER_STATUS_CHANGED = 'order.status-changed',
  ORDER_CANCELED = 'order.canceled',
  ORDER_REFUNDED = 'order.refunded',
  ORDER_PAID = 'order.paid',
  ORDER_FAILED = 'order.failed',
  ORDER_PROCESSED = 'order.processed',
  ORDER_SHIPPED = 'order.shipped',
  ORDER_DELIVERED = 'order.delivered',
}
