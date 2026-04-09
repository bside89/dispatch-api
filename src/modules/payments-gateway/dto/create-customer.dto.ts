import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIP,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseAddressDto } from '@/shared/dto/base-address.dto';
import {
  CustomerCashBalanceReconciliationMode,
  CustomerInvoiceAmountTaxDisplay,
  CustomerTaxExempt,
  CustomerTaxValidateLocation,
} from '../types/customer.types';

const CUSTOMER_TAX_EXEMPT_VALUES: CustomerTaxExempt[] = [
  'exempt',
  'none',
  'reverse',
];

const CUSTOMER_TAX_VALIDATE_LOCATION_VALUES: CustomerTaxValidateLocation[] = [
  'deferred',
  'immediately',
];

const CUSTOMER_CASH_BALANCE_RECONCILIATION_MODE_VALUES: CustomerCashBalanceReconciliationMode[] =
  ['automatic', 'manual', 'merchant_default'];

const CUSTOMER_INVOICE_AMOUNT_TAX_DISPLAY_VALUES: CustomerInvoiceAmountTaxDisplay[] =
  ['exclude_tax', 'include_inclusive_tax'];

export class CreateCustomerAddressDto extends BaseAddressDto {}

export class CreateCustomerShippingDto {
  @ApiProperty({ description: 'Shipping address', type: CreateCustomerAddressDto })
  @ValidateNested()
  @Type(() => CreateCustomerAddressDto)
  address: CreateCustomerAddressDto;

  @ApiProperty({ description: 'Recipient name', example: 'Joao Silva' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({
    description: 'Recipient phone number',
    example: '+5511999999999',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}

export class CreateCustomerInvoiceCustomFieldDto {
  @ApiProperty({ description: 'Invoice custom field name', example: 'CPF' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  name: string;

  @ApiProperty({
    description: 'Invoice custom field value',
    example: '123.456.789-09',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(140)
  value: string;
}

export class CreateCustomerInvoiceRenderingOptionsDto {
  @ApiPropertyOptional({
    description: 'How tax amounts are displayed in invoice PDFs',
    enum: CUSTOMER_INVOICE_AMOUNT_TAX_DISPLAY_VALUES,
    example: 'exclude_tax',
  })
  @IsOptional()
  @IsString()
  amountTaxDisplay?: 'exclude_tax' | 'include_inclusive_tax';

  @ApiPropertyOptional({
    description: 'Invoice rendering template identifier',
    example: 'inrtd_123456789',
  })
  @IsOptional()
  @IsString()
  template?: string;
}

export class CreateCustomerInvoiceSettingsDto {
  @ApiPropertyOptional({
    description: 'Default custom fields shown on invoices',
    type: [CreateCustomerInvoiceCustomFieldDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => CreateCustomerInvoiceCustomFieldDto)
  customFields?: CreateCustomerInvoiceCustomFieldDto[];

  @ApiPropertyOptional({
    description: 'Default payment method attached to the Stripe customer',
    example: 'pm_123456789',
  })
  @IsOptional()
  @IsString()
  defaultPaymentMethod?: string;

  @ApiPropertyOptional({
    description: 'Default footer for customer invoices',
    example: 'Obrigado pela preferencia.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  footer?: string;

  @ApiPropertyOptional({
    description: 'Default invoice PDF rendering options',
    type: CreateCustomerInvoiceRenderingOptionsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateCustomerInvoiceRenderingOptionsDto)
  renderingOptions?: CreateCustomerInvoiceRenderingOptionsDto;
}

export class CreateCustomerTaxDto {
  @ApiPropertyOptional({
    description: 'Customer IP address for tax location inference',
    example: '187.11.22.33',
  })
  @IsOptional()
  @IsIP()
  ipAddress?: string;

  @ApiPropertyOptional({
    description: 'When Stripe should validate the customer tax location',
    enum: CUSTOMER_TAX_VALIDATE_LOCATION_VALUES,
    example: 'deferred',
  })
  @IsOptional()
  @IsString()
  validateLocation?: 'deferred' | 'immediately';
}

export class CreateCustomerTaxIdDto {
  @ApiProperty({
    description: 'Stripe tax ID type',
    example: 'br_cpf',
  })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ description: 'Tax ID value', example: '12345678909' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  value: string;
}

export class CreateCustomerCashBalanceSettingsDto {
  @ApiPropertyOptional({
    description: 'How Stripe should reconcile customer balance funds',
    enum: CUSTOMER_CASH_BALANCE_RECONCILIATION_MODE_VALUES,
    example: 'automatic',
  })
  @IsOptional()
  @IsString()
  reconciliationMode?: 'automatic' | 'manual' | 'merchant_default';
}

export class CreateCustomerCashBalanceDto {
  @ApiPropertyOptional({
    description: 'Cash balance behavior settings for the customer',
    type: CreateCustomerCashBalanceSettingsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateCustomerCashBalanceSettingsDto)
  settings?: CreateCustomerCashBalanceSettingsDto;
}

export class CreateCustomerDto {
  @ApiProperty({
    description:
      'Primary customer email used for receipts and payment identification',
    example: 'cliente@empresa.com',
    format: 'email',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Customer display name or company legal name',
    example: 'Empresa XPTO LTDA',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({
    description: 'Customer billing address',
    type: CreateCustomerAddressDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateCustomerAddressDto)
  address?: CreateCustomerAddressDto;

  @ApiPropertyOptional({
    description: 'Current customer balance in cents for future invoices',
    example: 0,
  })
  @IsOptional()
  @IsInt()
  balance?: number;

  @ApiPropertyOptional({
    description: 'Business name when different from the display name',
    example: 'Empresa XPTO LTDA',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  businessName?: string;

  @ApiPropertyOptional({
    description: 'Cash balance settings',
    type: CreateCustomerCashBalanceDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateCustomerCashBalanceDto)
  cashBalance?: CreateCustomerCashBalanceDto;

  @ApiPropertyOptional({
    description: 'Internal description for dashboard operators',
    example: 'Cliente VIP do marketplace',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Individual legal name for tax identification',
    example: 'Joao da Silva',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  individualName?: string;

  @ApiPropertyOptional({
    description:
      'Invoice prefix used by Stripe. Must contain 3 to 12 uppercase letters or numbers',
    example: 'XPTO2026',
  })
  @IsOptional()
  @Matches(/^[A-Z0-9]{3,12}$/)
  invoicePrefix?: string;

  @ApiPropertyOptional({
    description: 'Default invoice settings',
    type: CreateCustomerInvoiceSettingsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateCustomerInvoiceSettingsDto)
  invoiceSettings?: CreateCustomerInvoiceSettingsDto;

  @ApiPropertyOptional({
    description: 'Free-form metadata stored on Stripe',
    example: {
      userId: '3f6dc5aa-1b2b-4c1a-a435-1de24a7eab11',
      tenantId: 'marketplace-br',
    },
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Next invoice sequence number', example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  nextInvoiceSequence?: number;

  @ApiPropertyOptional({
    description: 'Initial payment method to attach to the customer',
    example: 'pm_123456789',
  })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({
    description: 'Customer phone number',
    example: '+5511999999999',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({
    description: 'Preferred locales used by Stripe communications',
    example: ['pt-BR', 'en'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredLocales?: string[];

  @ApiPropertyOptional({
    description: 'Shipping information for invoices and physical deliveries',
    type: CreateCustomerShippingDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateCustomerShippingDto)
  shipping?: CreateCustomerShippingDto;

  @ApiPropertyOptional({
    description: 'Legacy card or source token to attach',
    example: 'src_123456789',
  })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({
    description: 'Tax inference data for the customer',
    type: CreateCustomerTaxDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateCustomerTaxDto)
  tax?: CreateCustomerTaxDto;

  @ApiPropertyOptional({
    description: 'Customer tax exemption status',
    enum: CUSTOMER_TAX_EXEMPT_VALUES,
    example: 'none',
  })
  @IsOptional()
  @IsString()
  taxExempt?: 'exempt' | 'none' | 'reverse';

  @ApiPropertyOptional({
    description: 'Tax IDs associated with the customer',
    type: [CreateCustomerTaxIdDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCustomerTaxIdDto)
  taxIdData?: CreateCustomerTaxIdDto[];

  @ApiPropertyOptional({
    description: 'Stripe test clock identifier for test environments',
    example: 'clock_123456789',
  })
  @IsOptional()
  @IsString()
  testClock?: string;

  @ApiPropertyOptional({
    description: 'Whether Stripe should validate the payload more strictly',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  validate?: boolean;
}
