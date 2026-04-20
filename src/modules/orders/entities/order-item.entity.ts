import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Order } from './order.entity';
import { Item } from '../../items/entities/item.entity';
import { DeactivatableEntity } from '@/shared/entities/deactivatable.entity';

@Entity('order_items')
export class OrderItem extends DeactivatableEntity {
  @Column('uuid')
  orderId: string;

  @ManyToOne(() => Order, (order) => order.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column('uuid')
  itemId: string;

  @ManyToOne(() => Item, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'itemId' })
  item: Item;

  @Column('integer')
  quantity: number;
}
