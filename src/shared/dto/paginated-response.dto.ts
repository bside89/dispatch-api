import { ApiProperty } from '@nestjs/swagger';

export class PaginatedResponseDto<T> {
  @ApiProperty({
    description: 'Indicates if the request was successful',
    example: true,
  })
  success: true;

  @ApiProperty({
    description: 'Response data',
    type: 'array',
  })
  data: T[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: 'object',
    additionalProperties: true,
  })
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };

  @ApiProperty({
    description: 'Response timestamp',
    example: '2024-01-01T12:00:00Z',
  })
  timestamp: string;
}
