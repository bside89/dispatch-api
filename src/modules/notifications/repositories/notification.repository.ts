import { PagCursorResultDto } from '@/shared/dto/pag-cursor-result.dto';
import { BaseRepository } from '@/shared/repositories/base.repository';
import { col } from '@/shared/utils/functions.utils';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationCursorQueryDto } from '../dto/notification-cursor-query.dto';
import { Notification } from '../entities/notification.entity';
import { INotificationRepository } from '../interfaces/notification-repository.interface';

const ALIAS_NOTIFICATION = 'notification';
const notification = col<Notification>(ALIAS_NOTIFICATION);

@Injectable()
export class NotificationRepository
  extends BaseRepository<Notification>
  implements INotificationRepository
{
  constructor(
    @InjectRepository(Notification)
    protected readonly repository: Repository<Notification>,
  ) {
    super(repository);
  }

  async filterByUser(
    query: NotificationCursorQueryDto,
  ): Promise<PagCursorResultDto<Notification>> {
    const { cursor, userId } = query;
    const limit = cursor?.limit || 20;

    const queryBuilder = this.createQueryBuilder(ALIAS_NOTIFICATION)
      .where(`${notification('userId')} = :userId`, { userId })
      .andWhere(`${notification('deletedAt')} IS NULL`)
      .orderBy(`${notification('createdAt')}`, 'DESC')
      .addOrderBy(`${notification('id')}`, 'DESC')
      .take(limit + 1);

    if (cursor?.startingAfter) {
      queryBuilder.andWhere(`${notification('createdAt')} < :startingAfter`, {
        startingAfter: cursor.startingAfter,
      });
    }

    const notifications = await queryBuilder.getMany();
    const hasNextPage = notifications.length > limit;
    const items = hasNextPage ? notifications.slice(0, limit) : notifications;
    const lastItem = items.at(-1);

    return {
      items,
      nextCursor: hasNextPage && lastItem ? this.encodeCursor(lastItem) : null,
      hasMore: hasNextPage,
    };
  }

  private encodeCursor(n: Notification): string {
    return Buffer.from(
      JSON.stringify({ startingAfter: n.createdAt.toISOString() }),
    ).toString('base64');
  }
}
