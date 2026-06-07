import { OutboxType } from '../modules/outbox/enums/outbox-type.enum';
import { BaseOutboxJobPayload } from '../modules/outbox/payloads/outbox.payload';

export class UpdateUserCustomerIdJobPayload extends BaseOutboxJobPayload {
  readonly type = OutboxType.USER_UPDATE_CUSTOMER_ID;

  constructor(
    public readonly userId: string,
    public readonly customerId: string | null,
  ) {
    super();
  }
}
