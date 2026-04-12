import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({
    description: 'Indicates that the request was unsuccessful',
    example: false,
  })
  success: false;

  @ApiProperty({
    description: 'Error message describing the reason for the failure',
    example: 'Invalid request data',
  })
  message: string;

  @ApiProperty({
    description: 'Detailed error information, if available',
    example: 'The "name" field is required and must be a string.',
  })
  error: string;

  @ApiProperty({
    description: 'HTTP status code of the error response',
    example: 400,
  })
  statusCode: number;

  @ApiProperty({
    description: 'Timestamp of when the error occurred',
    example: '2024-06-01T12:00:00Z',
  })
  timestamp: string;

  @ApiProperty({
    description: 'Path of the request that caused the error',
    example: '/v1/orders',
  })
  path: string;
}
