import { BaseOutboxJobPayload } from '../modules/outbox/payloads/outbox.payload';
import { OutboxType } from '../modules/outbox/enums/outbox-type.enum';

export abstract class SideEffectsJobPayload extends BaseOutboxJobPayload {}

export class NotifyUserJobPayload extends SideEffectsJobPayload {
  readonly type = OutboxType.SIDE_EFFECTS_NOTIFY_USER;

  constructor(
    public readonly userId: string,
    public readonly message: string,
  ) {
    super();
  }
}
