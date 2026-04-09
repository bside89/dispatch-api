import {
  CancelOrderJobPayload,
  DeliverOrderJobPayload,
  ProcessOrderJobPayload,
  RefundOrderJobPayload,
  ShipOrderJobPayload,
} from '@/shared/payloads/order-job.payload';
import {
  CreateCustomerJobPayload,
  DeleteCustomerJobPayload,
  UpdateCustomerJobPayload,
} from '@/shared/payloads/payment-job.payload';
import { NotifyUserJobPayload } from '@/shared/payloads/event-job.payload';
import { OutboxType } from '../enums/outbox-type.enum';

export interface OutboxPayloadMap {
  [OutboxType.ORDER_PROCESS]: ProcessOrderJobPayload;
  [OutboxType.ORDER_SHIP]: ShipOrderJobPayload;
  [OutboxType.ORDER_DELIVER]: DeliverOrderJobPayload;
  [OutboxType.ORDER_CANCEL]: CancelOrderJobPayload;
  [OutboxType.ORDER_REFUND]: RefundOrderJobPayload;
  [OutboxType.EVENTS_NOTIFY_USER]: NotifyUserJobPayload;
  [OutboxType.PAYMENT_CREATE_CUSTOMER]: CreateCustomerJobPayload;
  [OutboxType.PAYMENT_UPDATE_CUSTOMER]: UpdateCustomerJobPayload;
  [OutboxType.PAYMENT_DELETE_CUSTOMER]: DeleteCustomerJobPayload;
}
