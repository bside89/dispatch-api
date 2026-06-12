import { BaseOutboxJobPayload } from '../modules/outbox/payloads/outbox.payload';
import { OutboxType } from '../modules/outbox/enums/outbox-type.enum';
import { NotificationType } from '@/modules/notifications/enums/notification-type.enum';
import { NotificationEvent } from '@/modules/notifications/enums/notification-event.enum';

export abstract class EffectsJobPayload extends BaseOutboxJobPayload {}

export class NotifyUserJobPayload extends EffectsJobPayload {
  readonly type = OutboxType.EFFECTS_NOTIFY_USER;

  constructor(
    public readonly userId: string,
    public readonly notifType: NotificationType,
    public readonly notifEvent: NotificationEvent,
    public readonly notifData?: Record<string, any>,
  ) {
    super();
  }
}
