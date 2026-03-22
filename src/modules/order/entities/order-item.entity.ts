import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity('order_items')
export class OrderItem {
  @ApiProperty({
    description: 'Order item unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    description: 'Order ID that this item belongs to',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Column()
  orderId: string;

  @ApiProperty({
    description: 'Product unique identifier',
    example: 'product-123',
  })
  @Column()
  productId: string;

  @ApiProperty({
    description: 'Quantity of the product',
    example: 2,
    minimum: 1,
  })
  @Column()
  quantity: number;

  @ApiProperty({
    description: 'Price per unit',
    example: 149.99,
  })
  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @ApiProperty({
    description: 'Order item creation date',
    example: '2024-01-01T12:00:00Z',
  })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({
    description: 'Order item last update date',
    example: '2024-01-01T12:00:00Z',
  })
  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Order, (order) => order.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'orderId' })
  order: Order;
}
