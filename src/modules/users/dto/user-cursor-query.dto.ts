import { BaseCursorQueryDto } from '@/shared/dto/base-cursor-query.dto';

export class UserCursorQueryDto extends BaseCursorQueryDto {
  name?: string;

  email?: string;
}
