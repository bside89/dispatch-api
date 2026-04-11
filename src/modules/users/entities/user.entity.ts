import { Entity, Column, OneToMany, Index } from 'typeorm';
import { Order } from '../../orders/entities/order.entity';
import { UserRole } from '../enums/user-role.enum';
import { BaseEntity } from '@/shared/entities/base.entity';

@Entity('users')
@Index('IDX_user_email', ['email'], { unique: true })
export class User extends BaseEntity {
  @Column({ nullable: false })
  name: string;

  @Column({ nullable: true })
  customerId?: string;

  @Column({ nullable: false, unique: true })
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
  refreshToken?: string;

  @OneToMany(() => Order, (order) => order.user, { cascade: true })
  orders: Order[];
}
