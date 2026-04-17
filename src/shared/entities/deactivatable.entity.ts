import { Column } from 'typeorm';
import { BaseEntity } from './base.entity';

export abstract class DeactivatableEntity extends BaseEntity {
  @Column({ default: false })
  deactivated: boolean;

  @Column({ type: 'timestamp', nullable: true, default: null })
  deactivatedAt?: Date;
}
