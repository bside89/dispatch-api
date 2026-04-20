/* eslint-disable @typescript-eslint/no-explicit-any */
import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '@/modules/users/entities/user.entity';
import { DeactivatableEntity } from '@/shared/entities/deactivatable.entity';

@Entity('notifications')
@Index('IDX_notifications_user_read', ['userId'], {
  where: '"read" = false AND "deactivatedAt" IS NULL',
})
@Index('IDX_notifications_user_createdAt_id_active', ['userId', 'createdAt', 'id'], {
  where: '"deactivatedAt" IS NULL',
})
export class Notification extends DeactivatableEntity {
  @ManyToOne(() => User, (user) => user.notifications, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('uuid')
  userId: string;

  @Column({ type: 'varchar', length: 50 })
  type: string;

  @Column({ type: 'varchar', length: 120 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'jsonb', nullable: true })
  data?: Record<string, any>;

  @Column({ default: false })
  read: boolean;

  @Column({ type: 'timestamp', nullable: true })
  readAt?: Date;
}
