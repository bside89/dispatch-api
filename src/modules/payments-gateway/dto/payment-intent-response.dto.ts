import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose, Transform } from 'class-transformer';

@Exclude()
export class PaymentIntentResponseDto {
  @Expose()
  @ApiProperty({
    description: 'Stripe payment intent identifier',
    example: 'pi_123456789',
  })
  id: string;

  @Expose()
  @ApiProperty({
    description: 'Payment intent status',
    example: 'requires_confirmation',
  })
  status: string;

  @Expose()
  @ApiProperty({
    description: 'Payment amount in cents',
    example: 2599,
  })
  amount: number;

  @Expose()
  @ApiProperty({
    description: 'Three-letter ISO currency code',
    example: 'brl',
  })
  currency: string;

  @Expose({ name: 'customer' })
  @ApiPropertyOptional({
    description: 'Stripe customer identifier',
    example: 'cus_123456789',
  })
  customerId?: string | null;

  @Expose({ name: 'client_secret' })
  @ApiPropertyOptional({
    description: 'Client secret used by the frontend to confirm payment',
    example: 'pi_123456789_secret_123456789',
  })
  clientSecret?: string | null;

  @Expose({ name: 'payment_method' })
  @ApiPropertyOptional({
    description: 'Attached payment method identifier',
    example: 'pm_123456789',
  })
  paymentMethodId?: string | null;

  @Expose({ name: 'latest_charge' })
  @ApiPropertyOptional({
    description: 'Latest Stripe charge identifier',
    example: 'ch_123456789',
  })
  latestChargeId?: string | null;

  @Expose()
  @Transform(({ value }) => value, { toClassOnly: true })
  @ApiPropertyOptional({
    description: 'Free-form payment metadata',
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  metadata?: Record<string, string>;

  @Expose()
  @ApiProperty({
    description: 'Whether this payment intent belongs to live mode',
    example: false,
  })
  livemode: boolean;
}
