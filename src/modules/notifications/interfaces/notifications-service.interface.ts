import { PagCursorResultDto } from '@/shared/dto/pag-cursor-result.dto';
import { IBaseService } from '@/shared/providers/services/base-service.interface';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { NotificationResponseDto } from '../dto/notification-response.dto';
import { NotificationTranslatedResponseDto } from '@/modules/notifications/dto/notification-translated-response.dto';
import { NotificationCursorQueryDto } from '@/modules/notifications/dto/notification-cursor-query.dto';

export interface INotificationsService extends IBaseService {
  create(dto: CreateNotificationDto): Promise<NotificationResponseDto>;

  markAsRead(notificationId: string, userId: string): Promise<void>;

  findByUser(
    query: NotificationCursorQueryDto,
  ): Promise<PagCursorResultDto<NotificationTranslatedResponseDto>>;

  findTranslatedById(id: string): Promise<NotificationTranslatedResponseDto>;

  hasNewNotifications(userId: string): Promise<boolean>;

  countUnread(userId: string): Promise<number>;
}
