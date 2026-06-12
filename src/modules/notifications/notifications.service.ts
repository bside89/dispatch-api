import { I18N_NOTIFICATIONS } from '@/shared/constants/i18n';
import { LOCK_KEY } from '@/shared/constants/lock.key';
import { DbGuardService } from '@/shared/modules/db-guard/db-guard.service';
import { BaseService } from '@/shared/providers/services/base.service';
import { EntityMapper } from '@/shared/utils/entity-mapper.utils';
import { template } from '@/shared/utils/functions.utils';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { NOTIFICATION_REPOSITORY } from './constants/notifications.token';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';
import type { INotificationRepository } from './interfaces/notification-repository.interface';
import { INotificationsService } from './interfaces/notifications-service.interface';
import { NotificationTranslatedResponseDto } from '@/modules/notifications/dto/notification-translated-response.dto';
import { NotificationEvent } from '@/modules/notifications/enums/notification-event.enum';
import { NotificationOutputFactory } from '@/modules/notifications/providers/factories/notification-output.factory';
import { Notification } from '@/modules/notifications/entities/notification.entity';
import { PagCursorResultDto } from '@/shared/dto/pag-cursor-result.dto';
import { NotificationCursorQueryDto } from '@/modules/notifications/dto/notification-cursor-query.dto';

@Injectable()
export class NotificationsService
  extends BaseService
  implements INotificationsService
{
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notificationRepository: INotificationRepository,
    private readonly notificationOutputFactory: NotificationOutputFactory,
    private readonly guard: DbGuardService,
  ) {
    super(NotificationsService.name);
  }

  //#region Public

  async create(dto: CreateNotificationDto): Promise<NotificationResponseDto> {
    const notification = this.notificationRepository.createEntity({
      userId: dto.userId,
      type: dto.type,
      event: dto.event,
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

  async findByUser(
    query: NotificationCursorQueryDto,
  ): Promise<PagCursorResultDto<NotificationTranslatedResponseDto>> {
    const result = await this.notificationRepository.filterByUser(query);
    const notificationsTranslated = await this.translateBulk(
      result.items,
      query.language,
    );
    return new PagCursorResultDto<NotificationTranslatedResponseDto>(
      notificationsTranslated,
      result.nextCursor,
      result.hasMore,
    );
  }

  async findTranslatedById(id: string): Promise<NotificationTranslatedResponseDto> {
    const notification = await this.notificationRepository.findById(id, {
      relations: ['user'],
    });
    if (!notification) {
      throw new BadRequestException(
        template(I18N_NOTIFICATIONS.ERRORS.NOTIFICATION_NOT_FOUND),
      );
    }
    return this.translate(notification, notification.user.language);
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

  //#endregion

  //#region Private methods

  private async translate(
    notification: Notification,
    language: string,
  ): Promise<NotificationTranslatedResponseDto> {
    const result = await this.translateBulk([notification], language);
    return result[0];
  }

  private async translateBulk(
    notifications: Notification[],
    language: string,
  ): Promise<NotificationTranslatedResponseDto[]> {
    return Promise.all(
      notifications.map(async (notification) => {
        const { title, message } = await this.notificationOutputFactory.create(
          notification.event as NotificationEvent,
          notification.data,
          language,
        );
        return {
          ...notification,
          title,
          message,
        };
      }),
    );
  }

  //#endregion
}
