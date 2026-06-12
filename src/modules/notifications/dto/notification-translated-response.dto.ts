import { ApiProperty, OmitType } from '@nestjs/swagger';
import { NotificationResponseDto } from '@/modules/notifications/dto/notification-response.dto';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class NotificationTranslatedResponseDto extends OmitType(
  NotificationResponseDto,
  ['type', 'event', 'data'],
) {
  @Expose()
  @ApiProperty()
  title: string;

  @Expose()
  @ApiProperty()
  message: string;
}
