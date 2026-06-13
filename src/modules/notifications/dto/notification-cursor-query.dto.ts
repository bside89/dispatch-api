import { BaseCursorQueryDto } from '@/shared/dto/base-cursor-query.dto';

export class NotificationCursorQueryDto extends BaseCursorQueryDto {
  userId: string;

  language: string;
}
