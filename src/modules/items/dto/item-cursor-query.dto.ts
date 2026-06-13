import { BaseCursorQueryDto } from '@/shared/dto/base-cursor-query.dto';

export class ItemCursorQueryDto extends BaseCursorQueryDto {
  name?: string;

  description?: string;
}
