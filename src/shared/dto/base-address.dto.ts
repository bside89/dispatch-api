import { ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import {
  IsISO31661Alpha2,
  IsOptional,
  IsPostalCode,
  IsString,
  MaxLength,
} from 'class-validator';

@Exclude()
export abstract class BaseAddressDto {
  @Expose()
  @ApiPropertyOptional({ description: 'City', example: 'Sao Paulo' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @Expose()
  @ApiPropertyOptional({
    description: 'Country in ISO 3166-1 alpha-2',
    example: 'BR',
  })
  @IsOptional()
  @IsISO31661Alpha2()
  country?: string;

  @Expose()
  @ApiPropertyOptional({
    description: 'Address first line',
    example: 'Av. Paulista, 1000',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  line1?: string;

  @Expose()
  @ApiPropertyOptional({ description: 'Address second line', example: 'Apto 101' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  line2?: string;

  @Expose()
  @ApiPropertyOptional({ description: 'Postal code', example: '01310-100' })
  @IsOptional()
  @IsPostalCode('any')
  postalCode?: string;

  @Expose()
  @ApiPropertyOptional({ description: 'State or province', example: 'SP' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;
}
