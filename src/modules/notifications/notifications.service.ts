import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { BaseService } from '@/shared/services/base.service';
import { NOTIFICATION_REPOSITORY } from './constants/notifications.token';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { EntityMapper } from '@/shared/utils/entity-mapper.utils';
import { DbGuardService } from '@/shared/modules/db-guard/db-guard.service';
import { LOCK_KEY } from '@/shared/constants/lock.key';
import { INotificationsService } from './interfaces/notifications-service.interface';
import type { INotificationRepository } from './interfaces/notification-repository.interface';
import { CursorParams } from '@/shared/types/cursor-params.type';
import { I18N_NOTIFICATIONS } from '@/shared/constants/i18n';
import { template } from '@/shared/utils/functions.utils';

@Injectable()
export class NotificationsService
  extends BaseService
  implements INotificationsService
{
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notificationRepository: INotificationRepository,
    private readonly guard: DbGuardService,
  ) {
    super(NotificationsService.name);
  }

  async create(dto: CreateNotificationDto): Promise<NotificationResponseDto> {
    const notification = this.notificationRepository.createEntity({
      userId: dto.userId,
      type: dto.type,
      title: dto.title,
      message: dto.message,
      data: dto.data,
    });
    const result = await this.notificationRepository.save(notification);

    return EntityMapper.map(result, NotificationResponseDto);
  }

  markAsRead(id: string, userId: string): Promise<void> {
    return this.guard.lockAndTransaction(
      LOCK_KEY.NOTIFICATIONS.UPDATE(id),
      async () => this._markAsRead(id, userId),
    );
  }

  private async _markAsRead(id: string, userId: string): Promise<void> {
    const notification = await this.notificationRepository.findById(id);
    if (!notification) {
      throw new BadRequestException(
        template(I18N_NOTIFICATIONS.ERRORS.NOTIFICATION_NOT_FOUND),
      );
    }
    if (notification.userId !== userId) {
      throw new ForbiddenException(
        template(I18N_NOTIFICATIONS.ERRORS.ACCESS_DENIED),
      );
    }
    if (notification.read) {
      return;
    }

    notification.read = true;
    notification.readAt = new Date();

    await this.notificationRepository.save(notification);
  }

  async findByUser(userId: string, cursor?: CursorParams) {
    return this.notificationRepository.filterByUser(userId, cursor);
  }

  async hasNewNotifications(userId: string): Promise<boolean> {
    return this.notificationRepository.existsBy({
      where: { userId, read: false },
    });
  }

  async countUnread(userId: string): Promise<number> {
    return this.notificationRepository.count({
      where: { userId, read: false },
    });
  }
}
