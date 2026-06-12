import { ApiProperty } from '@nestjs/swagger';
import { NotificationEvent } from '@/modules/notifications/enums/notification-event.enum';
import { NotificationType } from '@/modules/notifications/enums/notification-type.enum';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class NotificationResponseDto {
  @Expose()
  @ApiProperty()
  id: string;

  @Expose()
  @ApiProperty()
  type: NotificationType;

  @Expose()
  @ApiProperty()
  event: NotificationEvent;

  @Expose()
  @ApiProperty({ required: false, type: Object })
  data?: Record<string, any>;

  @Expose()
  @ApiProperty()
  read: boolean;

  @Expose()
  @ApiProperty({ required: false, type: String, format: 'date-time' })
  readAt?: Date;

  @Expose()
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @Expose()
  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;
}
