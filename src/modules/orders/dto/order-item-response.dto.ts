import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';
import { ItemResponseDto } from '@/modules/items/dto/item-response.dto';

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
    description: 'Item unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  itemId: string;

  @Expose()
  @ApiProperty({
    description: 'Quantity of the item',
    example: 2,
    minimum: 1,
  })
  quantity: number;

  @Expose()
  @Type(() => ItemResponseDto)
  @ApiPropertyOptional({
    description: 'Item details',
    type: () => ItemResponseDto,
  })
  item?: ItemResponseDto;
}
