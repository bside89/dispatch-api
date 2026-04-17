import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { OmitType } from '@nestjs/swagger';

@Exclude()
export class ItemResponseDto {
  @Expose()
  @ApiProperty({
    description: 'Item unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @Expose()
  @ApiProperty({
    description: 'Item name',
    example: 'Wireless Headphones',
  })
  name: string;

  @Expose()
  @ApiProperty({
    description: 'Item description',
    example: 'High-quality wireless headphones with noise cancellation',
  })
  description: string;

  @Expose()
  @ApiProperty({
    description: 'Available stock quantity',
    example: 50,
  })
  stock: number;

  @Expose()
  @ApiProperty({
    description: 'Item price in cents',
    example: 14999,
  })
  price: number;

  @Expose()
  @ApiPropertyOptional({
    description: 'Payment gateway price ID',
    example: 'price_1234567890',
    nullable: true,
  })
  pricePaymentId?: string;

  @Expose()
  @ApiProperty({
    description: 'Item creation date',
    example: '2024-01-01T12:00:00Z',
  })
  createdAt: Date;

  @Expose()
  @ApiProperty({
    description: 'Item last update date',
    example: '2024-01-01T12:00:00Z',
  })
  updatedAt: Date;
}

export class PublicItemResponseDto extends OmitType(ItemResponseDto, [
  'pricePaymentId',
] as const) {}
