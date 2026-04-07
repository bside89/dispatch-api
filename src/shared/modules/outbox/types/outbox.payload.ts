import { NotifyUserJobPayload } from '@/shared/payloads/event-job.payload';
import {
  CancelOrderJobPayload,
  DeliverOrderJobPayload,
  ProcessOrderJobPayload,
  RefundOrderJobPayload,
  ShipOrderJobPayload,
} from '@/shared/payloads/order-job.payload';

export type OutboxPayload =
  | ProcessOrderJobPayload
  | ShipOrderJobPayload
  | DeliverOrderJobPayload
  | CancelOrderJobPayload
  | RefundOrderJobPayload
  | NotifyUserJobPayload;
