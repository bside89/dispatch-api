import { Entity, Column } from 'typeorm';
import { OutboxType } from '../enums/outbox-type.enum';
import { BaseEntity } from '@/shared/entities/base.entity';
import type { OutboxPayload } from '@/shared/modules/outbox/types/outbox.payload';

@Entity('outbox')
export class Outbox extends BaseEntity {
  @Column({ type: 'varchar', nullable: false })
  correlationId: string;

  @Column({
    type: 'enum',
    enum: OutboxType,
    nullable: false,
  })
  type: OutboxType;

  @Column('jsonb', { nullable: false })
  payload: OutboxPayload;
}
