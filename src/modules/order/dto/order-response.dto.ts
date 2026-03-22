import { ApiProperty } from '@nestjs/swagger';
import { Order } from '../entities/order.entity';

export class OrderResponseDto {
  @ApiProperty({
    description: 'Total number of orders',
    example: 100,
  })
  total: number;

  @ApiProperty({
    description: 'Current page',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Items per page',
    example: 10,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 10,
  })
  totalPages: number;

  @ApiProperty({
    description: 'Orders list',
    type: [Order],
  })
  data: Order[];
}