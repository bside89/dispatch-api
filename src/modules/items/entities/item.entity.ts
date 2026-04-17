import { Entity, Column } from 'typeorm';
import { DeactivatableEntity } from '@/shared/entities/deactivatable.entity';

@Entity('items')
export class Item extends DeactivatableEntity {
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
