import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ShipOrderDto {
  @ApiPropertyOptional({
    description: 'Carrier tracking number',
    example: 'BR123456789',
  })
  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @ApiPropertyOptional({
    description: 'Carrier name (e.g. Correios, Fedex)',
    example: 'Correios',
  })
  @IsOptional()
  @IsString()
  carrier?: string;
}
