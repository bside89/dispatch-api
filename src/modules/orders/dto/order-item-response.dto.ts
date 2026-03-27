import { ApiProperty } from '@nestjs/swagger';

export class OrderItemResponseDto {
  @ApiProperty({
    description: 'Order item unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  id: string;

  @ApiProperty({
    description: 'Order ID that this item belongs to',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  orderId: string;

  @ApiProperty({
    description: 'Product unique identifier',
    example: 'product-123',
  })
  productId: string;

  @ApiProperty({
    description: 'Quantity of the product',
    example: 2,
    minimum: 1,
  })
  quantity: number;

  @ApiProperty({
    description: 'Price per unit',
    example: 149.99,
  })
  price: number;

  @ApiProperty({
    description: 'Order item creation date',
    example: '2024-01-01T12:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Order item last update date',
    example: '2024-01-01T12:00:00Z',
  })
  updatedAt: Date;

  static fromEntity(orderItem: OrderItemResponseDto): OrderItemResponseDto {
    const dto = new OrderItemResponseDto();
    dto.id = orderItem.id;
    dto.orderId = orderItem.orderId;
    dto.productId = orderItem.productId;
    dto.quantity = orderItem.quantity;
    dto.price = orderItem.price;
    dto.createdAt = orderItem.createdAt;
    dto.updatedAt = orderItem.updatedAt;
    return dto;
  }
}
