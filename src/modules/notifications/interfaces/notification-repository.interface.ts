import { PagCursorResultDto } from '@/shared/dto/pag-cursor-result.dto';
import { IBaseRepository } from '@/shared/repositories/base-repository.interface';
import { NotificationCursorQueryDto } from '../dto/notification-cursor-query.dto';
import { Notification } from '../entities/notification.entity';

export interface INotificationRepository extends IBaseRepository<Notification> {
  filterByUser(
    query: NotificationCursorQueryDto,
  ): Promise<PagCursorResultDto<Notification>>;
}
