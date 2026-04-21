import { Injectable } from '@nestjs/common';
import { BaseRepository } from '@/shared/repositories/base.repository';
import { Notification } from '../entities/notification.entity';
import { Brackets, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { PagCursorResultDto } from '@/shared/dto/pag-cursor-result.dto';
import { col } from '@/shared/utils/functions.utils';
import { CursorParams } from '@/shared/types/cursor-params.type';

const ALIAS_NOTIFICATION = 'notification';
const notification = col<Notification>(ALIAS_NOTIFICATION);

@Injectable()
export class NotificationRepository extends BaseRepository<Notification> {
  constructor(
    @InjectRepository(Notification)
    protected readonly repository: Repository<Notification>,
  ) {
    super(repository);
  }

  async filterByUser(
    userId: string,
    cursor?: CursorParams,
    limit = 20,
  ): Promise<PagCursorResultDto<Notification>> {
    const queryBuilder = this.createQueryBuilder(ALIAS_NOTIFICATION)
      .where(`${notification('userId')} = :userId`, { userId })
      .andWhere(`${notification('deactivatedAt')} IS NULL`)
      .orderBy(`${notification('createdAt')}`, 'DESC')
      .addOrderBy(`${notification('id')}`, 'DESC')
      .take(limit + 1);

    if (cursor) {
      queryBuilder.andWhere(
        new Brackets((cursorQuery) => {
          cursorQuery.where(`${notification('createdAt')} < :cursorCreatedAt`, {
            cursorCreatedAt: cursor.createdAt,
          });
          cursorQuery.orWhere(
            `(${notification('createdAt')} = :cursorCreatedAt AND ${notification('id')} < :cursorId)`,
            {
              cursorCreatedAt: cursor.createdAt,
              cursorId: cursor.id,
            },
          );
        }),
      );
    }

    const notifications = await queryBuilder.getMany();
    const hasNextPage = notifications.length > limit;
    const items = hasNextPage ? notifications.slice(0, limit) : notifications;
    const lastItem = items.at(-1);

    return {
      items,
      nextCursor: hasNextPage && lastItem ? this.encodeCursor(lastItem) : null,
    };
  }

  private encodeCursor(notification: Notification): string {
    const cursor: CursorParams = {
      createdAt: notification.createdAt.toISOString(),
      id: notification.id,
    };

    return Buffer.from(JSON.stringify(cursor)).toString('base64');
  }
}
