import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNumber, IsPositive } from 'class-validator';

export class CreateOrderItemDto {
  @ApiProperty({
    description: 'Item unique identifier (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  itemId: string;

  @ApiProperty({
    description: 'Quantity of the item',
    example: 2,
    minimum: 1,
  })
  @IsNumber()
  @IsPositive()
  quantity: number;
}
