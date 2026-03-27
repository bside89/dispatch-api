import { ApiProperty } from '@nestjs/swagger';
import { OrderItem } from '../entities/order-item.entity';
import { OrderStatus } from '../enums/order-status.enum';
import { UserResponseDto } from '@/modules/users/dto/user-response.dto';
import { Order } from '../entities/order.entity';

export class OrderResponseDto {
  @ApiProperty({
    description: 'Order unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'User who placed the order',
    type: () => UserResponseDto,
  })
  user: UserResponseDto;

  @ApiProperty({
    description: 'Order status',
    enum: OrderStatus,
    example: OrderStatus.PENDING,
  })
  status: string;

  @ApiProperty({
    description: 'Order total amount',
    example: 299.99,
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

  @ApiProperty({
    description: 'Order items',
    type: () => [OrderItem],
  })
  items: OrderItem[];

  static fromEntity(order: Order): OrderResponseDto {
    const dto = new OrderResponseDto();
    dto.id = order.id;
    dto.user = UserResponseDto.fromEntity(order.user);
    dto.status = order.status;
    dto.total = order.total;
    dto.createdAt = order.createdAt;
    dto.updatedAt = order.updatedAt;
    dto.items = order.items;
    return dto;
  }
}
