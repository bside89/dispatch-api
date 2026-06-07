import { User } from '@/modules/users/entities/user.entity';
import { BaseEntity } from '@/shared/entities/base.entity';
import { Column, Entity, Index, JoinColumn, OneToOne } from 'typeorm';

@Entity('customers')
@Index(['userId'], { unique: true })
@Index(['gatewayCustomerId'], { unique: true })
export class Customer extends BaseEntity {
  @Column()
  gatewayCustomerId: string;

  @Column('uuid')
  userId: string;

  @Column()
  email: string;

  @Column()
  name: string;

  @OneToOne(() => User, (user) => user.customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
