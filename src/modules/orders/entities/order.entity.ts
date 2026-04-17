import { Entity, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { OrderStatus } from '../enums/order-status.enum';
import { OrderItem } from './order-item.entity';
import { User } from '../../users/entities/user.entity';
import { DeactivatableEntity } from '@/shared/entities/deactivatable.entity';

@Entity('orders')
export class Order extends DeactivatableEntity {
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

  @Column({ nullable: true, default: null })
  paymentIntentId?: string;

  @Column({ nullable: true, default: null })
  paymentIntentStatus?: string;

  @Column({ nullable: true, default: null })
  trackingNumber?: string;

  @Column({ nullable: true, default: null })
  carrier?: string;

  @Column({ type: 'timestamp', nullable: true, default: null })
  shippedAt?: Date;

  @Column({ type: 'timestamp', nullable: true, default: null })
  deliveredAt?: Date;

  @OneToMany(() => OrderItem, (item) => item.order, {
    cascade: true,
    eager: true,
  })
  items: OrderItem[];
}
