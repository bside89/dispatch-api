import { User } from '@/modules/users/entities/user.entity';
import { BaseEntity } from '@/shared/entities/base.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { NotificationType } from '@/modules/notifications/enums/notification-type.enum';
import { NotificationEvent } from '@/modules/notifications/enums/notification-event.enum';

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

  // Indexed to allow filtering notifications by type (e.g. ORDER, PAYMENT).
  @Index()
  @Column({ type: 'enum', enum: NotificationType, default: NotificationType.PUSH })
  type: NotificationType;

  @Column({ type: 'enum', enum: NotificationEvent })
  event: NotificationEvent;

  @Column({ type: 'jsonb', nullable: true })
  data?: any;

  @Column({ default: false })
  read: boolean;

  @Column({ type: 'timestamp', nullable: true })
  readAt?: Date;
}
