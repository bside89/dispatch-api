/* eslint-disable @typescript-eslint/no-explicit-any */
import { Entity, Column } from 'typeorm';
import { OutboxType } from '../enums/outbox-type.enum';
import { BaseEntity } from '@/shared/entities/base.entity';

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
  payload: any;
}
