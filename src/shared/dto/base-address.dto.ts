import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsISO31661Alpha2,
  IsOptional,
  IsPostalCode,
  IsString,
  MaxLength,
} from 'class-validator';

export abstract class BaseAddressDto {
  @ApiPropertyOptional({ description: 'City', example: 'Sao Paulo' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({
    description: 'Country in ISO 3166-1 alpha-2',
    example: 'BR',
  })
  @IsOptional()
  @IsISO31661Alpha2()
  country?: string;

  @ApiPropertyOptional({
    description: 'Address first line',
    example: 'Av. Paulista, 1000',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  line1?: string;

  @ApiPropertyOptional({ description: 'Address second line', example: 'Apto 101' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  line2?: string;

  @ApiPropertyOptional({ description: 'Postal code', example: '01310-100' })
  @IsOptional()
  @IsPostalCode('any')
  postalCode?: string;

  @ApiPropertyOptional({ description: 'State or province', example: 'SP' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;
}
