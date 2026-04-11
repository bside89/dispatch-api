import { Entity, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { OrderStatus } from '../enums/order-status.enum';
import { OrderItem } from './order-item.entity';
import { User } from '../../users/entities/user.entity';
import { BaseEntity } from '@/shared/entities/base.entity';

@Entity('orders')
export class Order extends BaseEntity {
  @ManyToOne(() => User, (user) => user.orders, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('uuid')
  userId: string;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @Column('integer')
  total: number;

  @Column('boolean', { default: false })
  paid: boolean;

  @OneToMany(() => OrderItem, (item) => item.order, {
    cascade: true,
    eager: true,
  })
  items: OrderItem[];
}
