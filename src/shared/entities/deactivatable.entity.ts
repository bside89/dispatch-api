import { DeleteDateColumn } from 'typeorm';
import { BaseEntity } from './base.entity';

export abstract class DeactivatableEntity extends BaseEntity {
  @DeleteDateColumn({ nullable: true })
  deactivatedAt?: Date;
}
