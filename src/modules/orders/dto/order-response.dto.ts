import { PaymentResponseDto } from '@/modules/payments/dto/payment-response.dto';
import { UserResponseDto } from '@/modules/users/dto/user-response.dto';
import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { OrderStatus } from '../enums/order-status.enum';
import { OrderItemResponseDto } from './order-item-response.dto';
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
  status: OrderStatus;

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
  @ApiProperty({
    description: 'Payment details',
    type: () => PaymentResponseDto,
  })
  @Type(() => PaymentResponseDto)
  @ValidateNested()
  payment: PaymentResponseDto;

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

export class PublicOrderResponseDto extends OmitType(OrderResponseDto, [
  'user',
] as const) {}
