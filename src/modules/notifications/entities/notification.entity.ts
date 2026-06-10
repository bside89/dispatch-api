import { User } from '@/modules/users/entities/user.entity';
import { BaseEntity } from '@/shared/entities/base.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

@Entity('notifications')
@Index('IDX_notifications_user_read', ['userId'], {
  where: '"read" = false AND "deletedAt" IS NULL',
})
@Index('IDX_notifications_user_createdAt_id_active', ['userId', 'createdAt', 'id'], {
  where: '"deletedAt" IS NULL',
})
export class Notification extends BaseEntity {
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
