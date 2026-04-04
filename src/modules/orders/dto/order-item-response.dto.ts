import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class OrderItemResponseDto {
  @Expose()
  @ApiProperty({
    description: 'Order item unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  id: string;

  @Expose()
  @ApiProperty({
    description: 'Order ID that this item belongs to',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  orderId: string;

  @Expose()
  @ApiProperty({
    description: 'Product unique identifier',
    example: 'product-123',
  })
  productId: string;

  @Expose()
  @ApiProperty({
    description: 'Quantity of the product',
    example: 2,
    minimum: 1,
  })
  quantity: number;

  @Expose()
  @ApiProperty({
    description: 'Price per unit (in cents)',
    example: 14999,
  })
  price: number;

  @Expose()
  @ApiProperty({
    description: 'Order item creation date',
    example: '2024-01-01T12:00:00Z',
  })
  createdAt: Date;

  @Expose()
  @ApiProperty({
    description: 'Order item last update date',
    example: '2024-01-01T12:00:00Z',
  })
  updatedAt: Date;
}
