import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class CustomerAddressResponseDto {
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
export class CustomerShippingResponseDto {
  @Expose()
  @Type(() => CustomerAddressResponseDto)
  @ApiPropertyOptional({
    description: 'Shipping address',
    type: () => CustomerAddressResponseDto,
  })
  address?: CustomerAddressResponseDto | null;

  @Expose()
  @ApiProperty({ description: 'Shipping recipient name', example: 'Joao Silva' })
  name: string;

  @Expose()
  @ApiPropertyOptional({
    description: 'Shipping recipient phone',
    example: '+5511999999999',
  })
  phone?: string | null;
}

@Exclude()
export class CustomerTaxIdResponseDto {
  @Expose()
  @ApiProperty({
    description: 'Stripe tax ID unique identifier',
    example: 'txi_123456789',
  })
  id: string;

  @Expose()
  @ApiProperty({ description: 'Tax ID type', example: 'br_cpf' })
  type: string;

  @Expose()
  @ApiProperty({ description: 'Tax ID value', example: '12345678909' })
  value: string;
}

@Exclude()
export class CustomerResponseDto {
  @Expose()
  @ApiProperty({
    description: 'Stripe customer identifier',
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
    description: 'Customer business name',
    example: 'Empresa XPTO LTDA',
  })
  businessName?: string | null;

  @Expose()
  @ApiPropertyOptional({
    description: 'Customer individual legal name',
    example: 'Joao da Silva',
  })
  individualName?: string | null;

  @Expose()
  @ApiPropertyOptional({ description: 'Customer phone', example: '+5511999999999' })
  phone?: string | null;

  @Expose()
  @ApiPropertyOptional({
    description: 'Internal customer description',
    example: 'Cliente VIP do marketplace',
  })
  description: string | null;

  @Expose()
  @ApiProperty({ description: 'Current customer balance in cents', example: 0 })
  balance: number;

  @Expose()
  @ApiPropertyOptional({
    description: 'Invoice prefix configured on Stripe',
    example: 'XPTO2026',
  })
  invoicePrefix?: string | null;

  @Expose()
  @ApiPropertyOptional({
    description: 'Default payment method attached to the customer',
    example: 'pm_123456789',
  })
  defaultPaymentMethodId?: string | null;

  @Expose()
  @ApiProperty({
    description: 'Preferred Stripe locales',
    example: ['pt-BR', 'en'],
    type: [String],
  })
  preferredLocales: string[];

  @Expose()
  @ApiProperty({
    description: 'Customer metadata stored on Stripe',
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { userId: '3f6dc5aa-1b2b-4c1a-a435-1de24a7eab11' },
  })
  metadata: Record<string, string>;

  @Expose()
  @ApiPropertyOptional({
    description: 'Customer tax exemption status',
    example: 'none',
  })
  taxExempt?: string | null;

  @Expose()
  @Type(() => CustomerAddressResponseDto)
  @ApiPropertyOptional({
    description: 'Customer billing address',
    type: () => CustomerAddressResponseDto,
  })
  address?: CustomerAddressResponseDto | null;

  @Expose()
  @Type(() => CustomerShippingResponseDto)
  @ApiPropertyOptional({
    description: 'Customer shipping data',
    type: () => CustomerShippingResponseDto,
  })
  shipping?: CustomerShippingResponseDto | null;

  @Expose()
  @Type(() => CustomerTaxIdResponseDto)
  @ApiProperty({
    description: 'Customer tax identifiers',
    type: () => [CustomerTaxIdResponseDto],
  })
  taxIds: CustomerTaxIdResponseDto[];

  @Expose()
  @ApiProperty({
    description: 'Stripe customer creation date',
    example: '2026-04-08T12:00:00.000Z',
  })
  createdAt: Date;

  @Expose()
  @ApiProperty({
    description: 'Whether this customer belongs to live mode',
    example: false,
  })
  livemode: boolean;
}
