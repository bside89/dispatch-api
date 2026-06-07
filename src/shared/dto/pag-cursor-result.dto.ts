import { ApiProperty } from '@nestjs/swagger';
import { BasePaginationResultDto } from './base-pagination-result.dto';

export class PagCursorResultDto<T> extends BasePaginationResultDto<T> {
  @ApiProperty({
    description: 'Cursor for the next page',
    example: 'eyJpZCI6IjEyMyJ9',
    nullable: true,
  })
  nextCursor?: string;

  @ApiProperty({
    description: 'Indicates if there are more items to fetch',
    example: true,
  })
  hasMore: boolean;

  constructor(items: T[], nextCursor?: string, hasMore = false) {
    super(items);
    this.nextCursor = nextCursor;
    this.hasMore = hasMore;
  }
}
