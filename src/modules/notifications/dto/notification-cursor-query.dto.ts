import { CursorQueryDto } from '@/shared/dto/cursor-query.dto';

export class NotificationCursorQueryDto {
  userId: string;

  language: string;

  cursor?: CursorQueryDto;
}
