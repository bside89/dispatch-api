import { ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ItemQueryDto {
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

export class PublicItemQueryDto extends PickType(ItemQueryDto, ['name'] as const) {}
