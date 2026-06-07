import { CursorQueryDto } from '@/shared/dto/cursor-query.dto';

export class UserCursorQueryDto {
  name?: string;
  email?: string;
  cursor?: CursorQueryDto;
}
