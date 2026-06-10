import { Notification } from '@/modules/notifications/entities/notification.entity';
import { Customer } from '@/modules/payments/entities/customer.entity';
import { Payment } from '@/modules/payments/entities/payment.entity';
import { BaseEntity } from '@/shared/entities/base.entity';
import { Column, Entity, Index, JoinColumn, OneToMany, OneToOne } from 'typeorm';
import { UserRole } from '@/shared/enums/user-role.enum';
import { Order } from '../../orders/entities/order.entity';
import { Address } from './address.entity';

@Entity('users')
@Index('IDX_user_email', ['email'], { unique: true })
export class User extends BaseEntity {
  @Column({ nullable: false })
  name: string;

  @Column({ nullable: true })
  customerId: string;

  @Column({ nullable: false })
  email: string;

  @Column({ nullable: false })
  password: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({ nullable: true })
  refreshToken: string;

  @Column({ default: 'en' })
  language: string;

  @OneToMany(() => Address, (address) => address.user, { cascade: true })
  addresses: Address[];

  @OneToMany(() => Order, (order) => order.user, { cascade: true })
  orders: Order[];

  @OneToMany(() => Notification, (notification) => notification.user, {
    cascade: true,
  })
  notifications: Notification[];

  @OneToOne(() => Customer, (customer) => customer.user)
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @OneToMany(() => Payment, (payment) => payment.user, { cascade: true })
  payments: Payment[];
}
