import { IBaseService } from '@/shared/services/base-service.interface';
import { NotificationResponseDto } from '../dto/notification-response.dto';
import { PagCursorResultDto } from '@/shared/dto/pag-cursor-result.dto';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { CursorParams } from '@/shared/types/cursor-params.type';

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
