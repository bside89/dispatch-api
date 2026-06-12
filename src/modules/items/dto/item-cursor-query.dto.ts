import { CursorQueryDto } from '@/shared/dto/cursor-query.dto';

export class ItemCursorQueryDto {
  name?: string;

  description?: string;

  cursor?: CursorQueryDto;
}
