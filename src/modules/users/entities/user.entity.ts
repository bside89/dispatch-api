import { Entity, Column, OneToMany, Index } from 'typeorm';
import { Order } from '../../orders/entities/order.entity';
import { UserRole } from '../../../shared/enums/user-role.enum';
import { DeactivatableEntity } from '@/shared/entities/deactivatable.entity';

@Entity('users')
@Index('IDX_user_email', ['email', 'deactivated'], { unique: true })
export class User extends DeactivatableEntity {
  @Column({ nullable: false })
  name: string;

  @Column({ nullable: true })
  customerId?: string;

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
  refreshToken?: string;

  @Column({ default: 'en' })
  language: string;

  @OneToMany(() => Order, (order) => order.user, { cascade: true })
  orders: Order[];
}
