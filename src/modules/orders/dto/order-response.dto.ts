import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';
import { OrderStatus } from '../enums/order-status.enum';
import { UserResponseDto } from '@/modules/users/dto/user-response.dto';
import { OrderItemResponseDto } from './order-item-response.dto';
import { PaymentIntentResponseDto } from '@/modules/payments-gateway/dto/payment-intent-response.dto';

@Exclude()
export class OrderPaymentIntentDto extends PickType(PaymentIntentResponseDto, [
  'id',
  'status',
] as const) {
  @Expose()
  @ApiPropertyOptional({
    description: 'Client secret used by the frontend to confirm payment',
    example: 'pi_123456789_secret_123456789',
  })
  clientSecret?: string | null;
}

@Exclude()
export class OrderResponseDto {
  @Expose()
  @ApiProperty({
    description: 'Order unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @Expose()
  @Type(() => UserResponseDto)
  @ApiPropertyOptional({
    description: 'User who placed the order',
    type: () => UserResponseDto,
  })
  user?: UserResponseDto;

  @Expose()
  @ApiProperty({
    description: 'Order status',
    enum: OrderStatus,
    example: OrderStatus.PENDING,
  })
  status: string;

  @Expose()
  @ApiProperty({
    description: 'Order total amount (in cents)',
    example: 29999,
  })
  total: number;

  @Expose()
  @ApiProperty({
    description: 'Order creation date',
    example: '2024-01-01T12:00:00Z',
  })
  createdAt: Date;

  @Expose()
  @ApiProperty({
    description: 'Order last update date',
    example: '2024-01-01T12:00:00Z',
  })
  updatedAt: Date;

  @Expose()
  @Type(() => OrderItemResponseDto)
  @ApiPropertyOptional({
    description: 'Order items',
    type: () => [OrderItemResponseDto],
  })
  items?: OrderItemResponseDto[];

  @Expose()
  @Type(() => OrderPaymentIntentDto)
  @ApiProperty({
    description: 'Payment intent associated with the order',
    type: () => OrderPaymentIntentDto,
  })
  paymentIntent: OrderPaymentIntentDto;

  @Expose()
  @ApiPropertyOptional({
    description: 'Shipping tracking number provided by the carrier',
    example: 'BR123456789',
  })
  trackingNumber?: string;

  @Expose()
  @ApiPropertyOptional({
    description: 'Carrier name (e.g. Correios, Fedex)',
    example: 'Correios',
  })
  carrier?: string;

  @Expose()
  @ApiPropertyOptional({
    description: 'Date when the order was shipped',
    example: '2024-01-02T10:00:00Z',
  })
  shippedAt?: Date;

  @Expose()
  @ApiPropertyOptional({
    description: 'Date when the order was delivered',
    example: '2024-01-05T14:30:00Z',
  })
  deliveredAt?: Date;
}
