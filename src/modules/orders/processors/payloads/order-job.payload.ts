import { BaseJobPayload } from '@/shared/jobs/base-job.payload';

export class OrderJobPayload extends BaseJobPayload {
  constructor(
    public readonly userId: string,
    public readonly orderId: string,
    public readonly userName: string = '',
  ) {
    super();
  }
}

export class ProcessOrderJobPayload extends OrderJobPayload {
  constructor(
    public readonly userId: string,
    public readonly orderId: string,
    public readonly total: number,
    public readonly userName: string = '',
  ) {
    super(userId, orderId, userName);
  }
}

export class ShipOrderJobPayload extends OrderJobPayload {}

export class DeliverOrderJobPayload extends OrderJobPayload {}

export class CancelOrderJobPayload extends OrderJobPayload {}

export class RefundOrderJobPayload extends OrderJobPayload {}
