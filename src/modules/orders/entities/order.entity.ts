import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { OrderStatus } from '../enums/order-status.enum';
import { OrderItem } from './order-item.entity';
import { User } from '../../users/entities/user.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.orders)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('uuid')
  userId: string;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: string;

  @Column('integer')
  total: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => OrderItem, (item) => item.order, {
    cascade: true,
    eager: true,
  })
  items: OrderItem[];
}
