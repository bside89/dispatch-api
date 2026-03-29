import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsPositive } from 'class-validator';

export class CreateOrderItemDto {
  @ApiProperty({
    description: 'Product unique identifier',
    example: 'product-123',
  })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({
    description: 'Quantity of the product',
    example: 2,
    minimum: 1,
  })
  @IsNumber()
  @IsPositive()
  quantity: number;

  @ApiProperty({
    description: 'Price per unit (in cents)',
    example: 14999,
    minimum: 1,
  })
  @IsNumber()
  @IsPositive()
  price: number;
}
