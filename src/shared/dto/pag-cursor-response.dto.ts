import { ApiProperty } from '@nestjs/swagger';
import { PagCursorResultDto } from './pag-cursor-result.dto';

export class PagCursorResponseDto<T> extends PagCursorResultDto<T> {
  @ApiProperty({
    description: 'Indicates if the request was successful',
    example: true,
  })
  success: true;

  @ApiProperty({
    description: 'Response timestamp',
    example: '2024-01-01T12:00:00Z',
  })
  timestamp: string;
}
