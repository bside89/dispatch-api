import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { Module } from '@nestjs/common';
import { NotificationRepository } from './repositories/notification.repository';
import {
  NOTIFICATION_REPOSITORY,
  NOTIFICATIONS_SERVICE,
} from './constants/notifications.token';
import { NotificationsController } from './notifications.controller';
import { Notification } from './entities/notification.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Notification])],
  controllers: [NotificationsController],
  providers: [
    {
      provide: NOTIFICATIONS_SERVICE,
      useClass: NotificationsService,
    },
    {
      provide: NOTIFICATION_REPOSITORY,
      useClass: NotificationRepository,
    },
  ],
  exports: [NOTIFICATIONS_SERVICE],
})
export class NotificationsModule {}
