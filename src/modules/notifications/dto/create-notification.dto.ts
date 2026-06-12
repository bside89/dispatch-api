import { NotificationEvent } from '@/modules/notifications/enums/notification-event.enum';
import { NotificationType } from '@/modules/notifications/enums/notification-type.enum';

export class CreateNotificationDto {
  userId: string;

  type: NotificationType;

  event: NotificationEvent;

  data?: Record<string, any>;
}
