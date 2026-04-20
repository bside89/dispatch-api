import { PagCursorResultDto } from '@/shared/dto/pag-cursor-result.dto';
import { IBaseRepository } from '@/shared/repositories/base-repository.interface';
import { Notification } from '../entities/notification.entity';
import { CursorParams } from '@/shared/types/cursor-params.type';

export interface INotificationRepository extends IBaseRepository<Notification> {
  filterByUser(
    userId: string,
    cursor?: CursorParams,
    limit?: number,
  ): Promise<PagCursorResultDto<Notification>>;
}
