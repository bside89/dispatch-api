import { ApiProperty } from '@nestjs/swagger';
import { BasePaginationResultDto } from './base-pagination-result.dto';

class PaginationMetaDto {
  @ApiProperty({
    description: 'Total number of items matching the query',
    example: 100,
  })
  total: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 10,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 10,
  })
  totalPages: number;
}

export class PagOffsetResultDto<T> extends BasePaginationResultDto<T> {
  @ApiProperty({
    description: 'Pagination metadata',
    type: PaginationMetaDto,
  })
  meta: PaginationMetaDto;

  constructor(total: number, page: number, limit: number, data: T[]) {
    super(data);
    this.meta = new PaginationMetaDto();
    this.meta.total = total;
    this.meta.page = page;
    this.meta.limit = limit;
    this.meta.totalPages = Math.ceil(total / limit);
  }
}
