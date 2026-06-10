import { PagCursorResultDto } from '@/shared/dto/pag-cursor-result.dto';
import { IBaseService } from '@/shared/providers/services/base-service.interface';
import { CursorParams } from '@/shared/types/cursor-params.type';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { NotificationResponseDto } from '../dto/notification-response.dto';

export interface INotificationsService extends IBaseService {
  create(dto: CreateNotificationDto): Promise<NotificationResponseDto>;

  markAsRead(notificationId: string, userId: string): Promise<void>;

  findByUser(
    userId: string,
    cursor?: CursorParams,
  ): Promise<PagCursorResultDto<NotificationResponseDto>>;

  hasNewNotifications(userId: string): Promise<boolean>;

  countUnread(userId: string): Promise<number>;
}
