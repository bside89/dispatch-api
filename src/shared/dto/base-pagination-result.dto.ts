import { ApiProperty } from '@nestjs/swagger';

export abstract class BasePaginationResultDto<T> {
  @ApiProperty({
    description: 'Array of items for the current page',
    type: [Object],
  })
  items: T[];

  constructor(items: T[] = []) {
    this.items = items;
  }
}
