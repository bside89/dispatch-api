import { UserSnapshotDto } from '../dto/user-snapshot.dto';
import { BaseOutboxJobPayload } from '../modules/outbox/payloads/outbox.payload';
import { OutboxType } from '../modules/outbox/enums/outbox-type.enum';

export abstract class PaymentJobPayload extends BaseOutboxJobPayload {
  constructor(public readonly userDto: UserSnapshotDto) {
    super();
  }
}

export class CreateCustomerJobPayload extends PaymentJobPayload {
  readonly type = OutboxType.PAYMENT_CREATE_CUSTOMER;
}

export class UpdateCustomerJobPayload extends PaymentJobPayload {
  readonly type = OutboxType.PAYMENT_UPDATE_CUSTOMER;
}

export class DeleteCustomerJobPayload extends PaymentJobPayload {
  readonly type = OutboxType.PAYMENT_DELETE_CUSTOMER;
}
