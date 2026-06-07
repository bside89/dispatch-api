import { PagCursorResultDto } from '@/shared/dto/pag-cursor-result.dto';
import { BaseRepository } from '@/shared/repositories/base.repository';
import { col } from '@/shared/utils/functions.utils';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderCursorQueryDto } from '../../dto/order-cursor-query.dto';
import { OrderItem } from '../../entities/order-item.entity';
import { Order } from '../../entities/order.entity';
import { IOrderRepository } from '../../interfaces/order-repository.interface';

const ALIAS_ORDER = 'order';
const ALIAS_ORDER_ITEM = 'orderItem';
const order = col<Order>(ALIAS_ORDER);
const orderItem = col<OrderItem>(ALIAS_ORDER_ITEM);

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

@Injectable()
export class OrderRepository
  extends BaseRepository<Order>
  implements IOrderRepository
{
  constructor(
    @InjectRepository(Order) protected readonly repository: Repository<Order>,
  ) {
    super(repository);
  }

  async filter(query: OrderCursorQueryDto): Promise<PagCursorResultDto<Order>> {
    const { userId, status, startDate, endDate, cursor } = query;
    const limit = cursor?.limit
      ? Math.min(cursor.limit, MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;

    const queryBuilder = this.createQueryBuilder(ALIAS_ORDER)
      .leftJoinAndSelect(order('items'), ALIAS_ORDER_ITEM)
      .leftJoinAndSelect(orderItem('item'), 'item')
      .innerJoinAndSelect(order('user'), 'user')
      .orderBy(order('createdAt'), 'DESC')
      .addOrderBy(order('id'), 'DESC')
      .take(limit + 1);

    if (userId) {
      queryBuilder.andWhere(`${order('userId')} = :userId`, { userId });
    }
    if (status) {
      queryBuilder.andWhere(`${order('status')} = :status`, { status });
    }
    if (startDate && endDate) {
      queryBuilder.andWhere(
        `${order('createdAt')} BETWEEN :startDate AND :endDate`,
        { startDate, endDate },
      );
    }
    if (cursor?.startingAfter) {
      queryBuilder.andWhere(`${order('createdAt')} < :startingAfter`, {
        startingAfter: cursor.startingAfter,
      });
    }

    const rows = await queryBuilder.getMany();
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const lastItem = items.at(-1);

    return new PagCursorResultDto(
      items,
      hasMore && lastItem ? this.encodeCursor(lastItem) : undefined,
      hasMore,
    );
  }

  private encodeCursor(o: Order): string {
    return Buffer.from(
      JSON.stringify({ startingAfter: o.createdAt.toISOString() }),
    ).toString('base64');
  }
}
