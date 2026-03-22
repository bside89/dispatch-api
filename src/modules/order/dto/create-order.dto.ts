import { IsString, IsArray, ValidateNested, IsNotEmpty, IsPositive, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

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
    description: 'Price per unit',
    example: 149.99,
    minimum: 0.01,
  })
  @IsNumber()
  @IsPositive()
  price: number;
}

export class CreateOrderDto {
  @ApiProperty({
    description: 'Customer unique identifier',
    example: 'customer-123',
  })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({
    description: 'Order items',
    type: [CreateOrderItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}