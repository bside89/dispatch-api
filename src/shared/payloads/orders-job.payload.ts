import { OutboxType } from '../modules/outbox/enums/outbox-type.enum';
import { BaseOutboxJobPayload } from '../modules/outbox/payloads/outbox.payload';

export abstract class OrdersJobPayload extends BaseOutboxJobPayload {
  constructor(public readonly orderId: string) {
    super();
  }
}

export class ProcessOrderJobPayload extends OrdersJobPayload {
  readonly type = OutboxType.ORDER_PROCESS;
}

export class ShipOrderJobPayload extends OrdersJobPayload {
  readonly type = OutboxType.ORDER_SHIP;
}

export class DeliverOrderJobPayload extends OrdersJobPayload {
  readonly type = OutboxType.ORDER_DELIVER;
}

export class CancelOrderJobPayload extends OrdersJobPayload {
  readonly type = OutboxType.ORDER_CANCEL;
}

export class RefundOrderJobPayload extends OrdersJobPayload {
  readonly type = OutboxType.ORDER_REFUND;
}
