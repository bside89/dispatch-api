import { BaseOutboxJobPayload } from '../modules/outbox/payloads/outbox.payload';
import { OutboxType } from '../modules/outbox/enums/outbox-type.enum';

export abstract class EventJobPayload extends BaseOutboxJobPayload {}

export class NotifyUserJobPayload extends EventJobPayload {
  readonly type = OutboxType.EVENTS_NOTIFY_USER;

  constructor(
    public readonly userId: string,
    public readonly message: string,
  ) {
    super();
  }
}
