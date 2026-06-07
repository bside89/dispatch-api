import { ApiProperty } from '@nestjs/swagger';

export class CursorQueryDto {
  @ApiProperty({
    description: 'Cursor for pagination (can be a parameter like createdAt)',
    example: '2026-01-01T00:00:00.000Z_123',
    nullable: true,
  })
  startingAfter?: string;

  @ApiProperty({
    description: 'Number of items to return per page',
    example: 20,
    default: 20,
  })
  limit?: number;
}
