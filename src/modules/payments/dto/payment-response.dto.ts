import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class PaymentResponseDto {
  @Expose()
  @ApiProperty({
    description: 'Payment unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @Expose()
  @ApiProperty({
    description: 'Order unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  orderId: string;

  @Expose()
  @ApiProperty({
    description: 'User unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId: string;

  @Expose()
  @ApiProperty({
    description: 'Stripe payment intent identifier',
    example: 'pi_123456789',
  })
  stripePaymentIntentId: string;

  @Expose()
  @ApiProperty({
    description: 'Stripe client secret',
    example: 'sk_test_123456789',
  })
  stripeClientSecret: string;

  @Expose()
  @ApiProperty({
    description: 'Payment status',
    example: 'succeeded',
  })
  status: string;
}
