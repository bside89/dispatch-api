import { ApiProperty } from '@nestjs/swagger';
import { PagOffsetResultDto } from './pag-offset-result.dto';

export class PagOffsetResponseDto<T> extends PagOffsetResultDto<T> {
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
