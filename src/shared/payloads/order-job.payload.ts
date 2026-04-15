import { BaseJobPayload } from '@/shared/payloads/base-job.payload';

export class OrderJobPayload extends BaseJobPayload {
  constructor(public readonly orderId: string) {
    super();
  }
}

export class ProcessOrderJobPayload extends OrderJobPayload {}

export class ShipOrderJobPayload extends OrderJobPayload {}

export class DeliverOrderJobPayload extends OrderJobPayload {}

export class CancelOrderJobPayload extends OrderJobPayload {}

export class RefundOrderJobPayload extends OrderJobPayload {}
