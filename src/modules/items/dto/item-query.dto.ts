import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { BaseQueryDto } from '@/shared/dto/base-query.dto';

export class ItemQueryDto extends BaseQueryDto {
  @ApiPropertyOptional({
    description: 'Filter items by name (partial match)',
    example: 'Headphones',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Filter items by description (partial match)',
    example: 'wireless',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
