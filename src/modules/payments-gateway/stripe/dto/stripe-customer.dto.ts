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
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { BaseAddressDto } from '@/shared/dto/base-address.dto';
import {
  StripeCustomerCashBalanceReconciliationMode,
  StripeCustomerInvoiceAmountTaxDisplay,
  StripeCustomerTaxExempt as StripeCustomerTaxExempt,
  StripeCustomerTaxValidateLocation as StripeCustomerTaxValidateLocation,
} from '../types/stripe-customer.type';

const STRIPE_CUSTOMER_TAX_EXEMPT_VALUES: StripeCustomerTaxExempt[] = [
  'exempt',
  'none',
  'reverse',
];

const STRIPE_CUSTOMER_TAX_VALIDATE_LOCATION_VALUES: StripeCustomerTaxValidateLocation[] =
  ['deferred', 'immediately'];

const STRIPE_CUSTOMER_CASH_BALANCE_RECONCILIATION_MODE_VALUES: StripeCustomerCashBalanceReconciliationMode[] =
  ['automatic', 'manual', 'merchant_default'];

const STRIPE_CUSTOMER_INVOICE_AMOUNT_TAX_DISPLAY_VALUES: StripeCustomerInvoiceAmountTaxDisplay[] =
  ['exclude_tax', 'include_inclusive_tax'];

export class StripeCreateCustomerAddressDto extends BaseAddressDto {}

export class StripeCreateCustomerShippingDto {
  @ApiProperty({
    description: 'Shipping address',
    type: StripeCreateCustomerAddressDto,
  })
  @ValidateNested()
  @Type(() => StripeCreateCustomerAddressDto)
  address: StripeCreateCustomerAddressDto;

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

export class StripeCreateCustomerInvoiceCustomFieldDto {
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

export class StripeCreateCustomerInvoiceRenderingOptionsDto {
  @ApiPropertyOptional({
    description: 'How tax amounts are displayed in invoice PDFs',
    enum: STRIPE_CUSTOMER_INVOICE_AMOUNT_TAX_DISPLAY_VALUES,
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

export class StripeCreateCustomerInvoiceSettingsDto {
  @ApiPropertyOptional({
    description: 'Default custom fields shown on invoices',
    type: [StripeCreateCustomerInvoiceCustomFieldDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => StripeCreateCustomerInvoiceCustomFieldDto)
  customFields?: StripeCreateCustomerInvoiceCustomFieldDto[];

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
    type: StripeCreateCustomerInvoiceRenderingOptionsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => StripeCreateCustomerInvoiceRenderingOptionsDto)
  renderingOptions?: StripeCreateCustomerInvoiceRenderingOptionsDto;
}

export class StripeCreateCustomerTaxDto {
  @ApiPropertyOptional({
    description: 'Customer IP address for tax location inference',
    example: '187.11.22.33',
  })
  @IsOptional()
  @IsIP()
  ipAddress?: string;

  @ApiPropertyOptional({
    description: 'When Stripe should validate the customer tax location',
    enum: STRIPE_CUSTOMER_TAX_VALIDATE_LOCATION_VALUES,
    example: 'deferred',
  })
  @IsOptional()
  @IsString()
  validateLocation?: 'deferred' | 'immediately';
}

export class StripeCreateCustomerTaxIdDto {
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

export class StripeCreateCustomerCashBalanceSettingsDto {
  @ApiPropertyOptional({
    description: 'How Stripe should reconcile customer balance funds',
    enum: STRIPE_CUSTOMER_CASH_BALANCE_RECONCILIATION_MODE_VALUES,
    example: 'automatic',
  })
  @IsOptional()
  @IsString()
  reconciliationMode?: 'automatic' | 'manual' | 'merchant_default';
}

export class StripeCreateCustomerCashBalanceDto {
  @ApiPropertyOptional({
    description: 'Cash balance behavior settings for the customer',
    type: StripeCreateCustomerCashBalanceSettingsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => StripeCreateCustomerCashBalanceSettingsDto)
  settings?: StripeCreateCustomerCashBalanceSettingsDto;
}

export class StripeCreateCustomerDto {
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
    type: StripeCreateCustomerAddressDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => StripeCreateCustomerAddressDto)
  address?: StripeCreateCustomerAddressDto;

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
    type: StripeCreateCustomerCashBalanceDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => StripeCreateCustomerCashBalanceDto)
  cashBalance?: StripeCreateCustomerCashBalanceDto;

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
    type: StripeCreateCustomerInvoiceSettingsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => StripeCreateCustomerInvoiceSettingsDto)
  invoiceSettings?: StripeCreateCustomerInvoiceSettingsDto;

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
    type: StripeCreateCustomerShippingDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => StripeCreateCustomerShippingDto)
  shipping?: StripeCreateCustomerShippingDto;

  @ApiPropertyOptional({
    description: 'Legacy card or source token to attach',
    example: 'src_123456789',
  })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({
    description: 'Tax inference data for the customer',
    type: StripeCreateCustomerTaxDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => StripeCreateCustomerTaxDto)
  tax?: StripeCreateCustomerTaxDto;

  @ApiPropertyOptional({
    description: 'Customer tax exemption status',
    enum: STRIPE_CUSTOMER_TAX_EXEMPT_VALUES,
    example: 'none',
  })
  @IsOptional()
  @IsString()
  taxExempt?: 'exempt' | 'none' | 'reverse';

  @ApiPropertyOptional({
    description: 'Tax IDs associated with the customer',
    type: [StripeCreateCustomerTaxIdDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StripeCreateCustomerTaxIdDto)
  taxIdData?: StripeCreateCustomerTaxIdDto[];

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

export class StripeUpdateCustomerAddressDto extends PartialType(
  StripeCreateCustomerAddressDto,
) {}

export class StripeUpdateCustomerShippingDto extends PartialType(
  StripeCreateCustomerShippingDto,
) {}

export class StripeUpdateCustomerInvoiceCustomFieldDto extends PartialType(
  StripeCreateCustomerInvoiceCustomFieldDto,
) {}

export class StripeUpdateCustomerInvoiceRenderingOptionsDto extends PartialType(
  StripeCreateCustomerInvoiceRenderingOptionsDto,
) {}

export class StripeUpdateCustomerInvoiceSettingsDto extends PartialType(
  StripeCreateCustomerInvoiceSettingsDto,
) {}

export class StripeUpdateCustomerTaxDto extends PartialType(
  StripeCreateCustomerTaxDto,
) {}

export class StripeUpdateCustomerTaxIdDto extends PartialType(
  StripeCreateCustomerTaxIdDto,
) {}

export class StripeUpdateCustomerCashBalanceSettingsDto extends PartialType(
  StripeCreateCustomerCashBalanceSettingsDto,
) {}

export class StripeUpdateCustomerCashBalanceDto extends PartialType(
  StripeCreateCustomerCashBalanceDto,
) {}

export class StripeUpdateCustomerDto extends PartialType(StripeCreateCustomerDto) {}
