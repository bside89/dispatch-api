import { OutboxType } from '../modules/outbox/enums/outbox-type.enum';
import { BaseOutboxJobPayload } from '../modules/outbox/payloads/outbox.payload';

export class UpdateUserJobPayload extends BaseOutboxJobPayload {
  readonly type = OutboxType.USER_UPDATE;

  constructor(
    public readonly userId: string,
    public readonly customerId: string | null,
  ) {
    super();
  }
}
