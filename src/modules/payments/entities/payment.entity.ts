import { Order } from '@/modules/orders/entities/order.entity';
import { User } from '@/modules/users/entities/user.entity';
import { BaseEntity } from '@/shared/entities/base.entity';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { Refund } from './refund.entity';

@Entity('payments')
export class Payment extends BaseEntity {
  @Index({ unique: true })
  @Column('uuid')
  orderId: string;

  @Index()
  @Column('uuid')
  userId: string;

  @Index({ unique: true })
  @Column()
  stripePaymentIntentId: string;

  @Column()
  stripeClientSecret: string;

  @Column()
  status: string;

  @OneToMany(() => Refund, (refund) => refund.payment)
  refunds: Refund[];

  @ManyToOne(() => User, (user) => user.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToOne(() => Order, (order) => order.payment)
  @JoinColumn({ name: 'orderId' })
  order: Order;
}
