import {
  CancelOrderJobPayload,
  DeliverOrderJobPayload,
  ProcessOrderJobPayload,
  RefundOrderJobPayload,
  ShipOrderJobPayload,
} from '@/modules/orders/processors/payloads/order-job.payload';
import { NotifyUserJobPayload } from '@/shared/modules/events/processors/payloads/event-job.payload';
import { OutboxType } from '../enums/outbox-type.enum';

export interface OutboxPayloadMap {
  [OutboxType.ORDER_PROCESS]: ProcessOrderJobPayload;
  [OutboxType.ORDER_SHIP]: ShipOrderJobPayload;
  [OutboxType.ORDER_DELIVER]: DeliverOrderJobPayload;
  [OutboxType.ORDER_CANCEL]: CancelOrderJobPayload;
  [OutboxType.ORDER_REFUND]: RefundOrderJobPayload;
  [OutboxType.EVENTS_NOTIFY_USER]: NotifyUserJobPayload;
}
