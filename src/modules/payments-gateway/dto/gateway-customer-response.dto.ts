import { ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class GatewayAddressResponseDto {
  @Expose()
  @ApiPropertyOptional({ description: 'Customer city', example: 'Sao Paulo' })
  city?: string | null;

  @Expose()
  @ApiPropertyOptional({
    description: 'Customer country in ISO 3166-1 alpha-2',
    example: 'BR',
  })
  country?: string | null;

  @Expose()
  @ApiPropertyOptional({
    description: 'Address first line',
    example: 'Av. Paulista, 1000',
  })
  line1?: string | null;

  @Expose()
  @ApiPropertyOptional({ description: 'Address second line', example: 'Apto 101' })
  line2?: string | null;

  @Expose()
  @ApiPropertyOptional({ description: 'Postal code', example: '01310-100' })
  postalCode?: string | null;

  @Expose()
  @ApiPropertyOptional({ description: 'State or province', example: 'SP' })
  state?: string | null;
}

@Exclude()
export class GatewayCustomerResponseDto {
  @Expose()
  @ApiPropertyOptional({
    description: 'Payment gateway customer identifier',
    example: 'cus_123456789',
  })
  id: string;

  @Expose()
  @ApiPropertyOptional({
    description: 'Customer email',
    example: 'cliente@empresa.com',
  })
  email: string | null;

  @Expose()
  @ApiPropertyOptional({
    description: 'Customer display name',
    example: 'Empresa XPTO LTDA',
  })
  name: string | null;

  @Expose()
  @ApiPropertyOptional({
    description: 'Customer metadata',
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { userId: '3f6dc5aa-1b2b-4c1a-a435-1de24a7eab11' },
  })
  metadata: Record<string, string>;

  @Expose()
  @Type(() => GatewayAddressResponseDto)
  @ApiPropertyOptional({
    description: 'Customer billing address',
    type: () => GatewayAddressResponseDto,
  })
  address?: GatewayAddressResponseDto | null;
}
