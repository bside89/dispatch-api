import { Entity, Column } from 'typeorm';
import { BaseEntity } from '@/shared/entities/base.entity';

@Entity('items')
export class Item extends BaseEntity {
  @Column({ nullable: false })
  name: string;

  @Column({ type: 'text', nullable: false })
  description: string;

  @Column('integer')
  stock: number;

  @Column('integer')
  price: number;

  @Column({ nullable: true, default: null })
  pricePaymentId?: string;
}
