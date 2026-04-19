import { OutboxType } from '../modules/outbox/enums/outbox-type.enum';
import { BaseOutboxJobPayload } from '../modules/outbox/payloads/outbox.payload';

export abstract class OrderJobPayload extends BaseOutboxJobPayload {
  constructor(public readonly orderId: string) {
    super();
  }
}

export class ProcessOrderJobPayload extends OrderJobPayload {
  readonly type = OutboxType.ORDER_PROCESS;
}

export class ShipOrderJobPayload extends OrderJobPayload {
  readonly type = OutboxType.ORDER_SHIP;
}

export class DeliverOrderJobPayload extends OrderJobPayload {
  readonly type = OutboxType.ORDER_DELIVER;
}

export class CancelOrderJobPayload extends OrderJobPayload {
  readonly type = OutboxType.ORDER_CANCEL;
}

export class RefundOrderJobPayload extends OrderJobPayload {
  readonly type = OutboxType.ORDER_REFUND;
}
