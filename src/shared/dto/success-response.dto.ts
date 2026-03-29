import { ApiProperty } from '@nestjs/swagger';

export class SuccessResponseDto<T> {
  @ApiProperty({
    description: 'Indicates if the request was successful',
    example: true,
  })
  success: true;

  @ApiProperty({
    description: 'Response message',
    example: 'Request was successful',
  })
  message: string;

  @ApiProperty({
    description: 'Response data',
    type: 'object',
    additionalProperties: true,
  })
  data: T;

  @ApiProperty({
    description: 'Response timestamp',
    example: '2024-01-01T12:00:00Z',
  })
  timestamp: string;
}
