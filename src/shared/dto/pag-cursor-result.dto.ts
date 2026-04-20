import { ApiProperty } from '@nestjs/swagger';
import { BasePaginationResultDto } from './base-pagination-result.dto';

export class PagCursorResultDto<T> extends BasePaginationResultDto<T> {
  @ApiProperty({
    description: 'Cursor for the next page',
    example: 'eyJpZCI6IjEyMyJ9',
    nullable: true,
  })
  nextCursor: string | null;
}
