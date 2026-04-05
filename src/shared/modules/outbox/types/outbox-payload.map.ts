import {
  CancelOrderJobPayload,
  DeliverOrderJobPayload,
  ProcessOrderJobPayload,
  ShipOrderJobPayload,
} from '@/modules/orders/processors/payloads/order-job.payload';
import { NotifyUserJobPayload } from '@/shared/modules/events/processors/payloads/notify-user.payload';
import { OutboxType } from '../enums/outbox-type.enum';

export interface OutboxPayloadMap {
  [OutboxType.ORDER_PROCESS]: ProcessOrderJobPayload;
  [OutboxType.ORDER_SHIP]: ShipOrderJobPayload;
  [OutboxType.ORDER_DELIVER]: DeliverOrderJobPayload;
  [OutboxType.ORDER_CANCEL]: CancelOrderJobPayload;
  [OutboxType.EVENTS_NOTIFY_USER]: NotifyUserJobPayload;
}
