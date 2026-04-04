import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { OutboxType } from '../enums/outbox-type.enum';

@Entity('outbox')
export class Outbox {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  @CreateDateColumn()
  createdAt: Date;
}
