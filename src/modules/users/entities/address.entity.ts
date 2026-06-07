import { BaseEntity } from '@/shared/entities/base.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { User } from './user.entity';

@Entity('addresses')
export class Address extends BaseEntity {
  @Index()
  @Column('uuid')
  userId: string;

  @Column()
  line1: string;

  @Column({ nullable: true })
  line2?: string;

  @Column()
  city: string;

  @Column()
  state: string;

  @Column()
  country: string;

  @Column()
  postalCode: string;

  @ManyToOne(() => User, (user) => user.addresses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
