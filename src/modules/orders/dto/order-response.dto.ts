import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '../enums/order-status.enum';
import { UserResponseDto } from '@/modules/users/dto/user-response.dto';
import { Order } from '../entities/order.entity';
import { OrderItemResponseDto } from './order-item-response.dto';

export class OrderResponseDto {
  @ApiProperty({
    description: 'Order unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiPropertyOptional({
    description: 'User who placed the order',
    type: () => UserResponseDto,
  })
  user?: UserResponseDto;

  @ApiProperty({
    description: 'Order status',
    enum: OrderStatus,
    example: OrderStatus.PENDING,
  })
  status: string;

  @ApiProperty({
    description: 'Order total amount (in cents)',
    example: 29999,
  })
  total: number;

  @ApiProperty({
    description: 'Order creation date',
    example: '2024-01-01T12:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Order last update date',
    example: '2024-01-01T12:00:00Z',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Order items',
    type: () => [OrderItemResponseDto],
  })
  items?: OrderItemResponseDto[];

  static fromEntity(order: Order): OrderResponseDto {
    const dto = new OrderResponseDto();
    dto.id = order.id;
    if (order.user) {
      dto.user = UserResponseDto.fromEntity(order.user);
    }
    dto.status = order.status;
    dto.total = order.total;
    dto.createdAt = order.createdAt;
    dto.updatedAt = order.updatedAt;
    if (order.items) {
      dto.items = order.items.map(OrderItemResponseDto.fromEntity);
    }
    return dto;
  }
}
