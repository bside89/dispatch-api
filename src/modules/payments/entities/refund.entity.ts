import { BaseEntity } from '@/shared/entities/base.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Payment } from './payment.entity';

@Entity('refunds')
export class Refund extends BaseEntity {
  @Index()
  @Column('uuid')
  paymentId: string;

  @ManyToOne(() => Payment, (payment) => payment.refunds, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'paymentId' })
  payment: Payment;

  @Index({ unique: true })
  @Column()
  gatewayRefundId: string;

  @Column('integer')
  amount: number;
}
