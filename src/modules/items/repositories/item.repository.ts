/* eslint-disable @typescript-eslint/no-explicit-any */
import { PagCursorResultDto } from '@/shared/dto/pag-cursor-result.dto';
import { BaseRepository } from '@/shared/repositories/base.repository';
import { col } from '@/shared/utils/functions.utils';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ItemCursorQueryDto } from '../dto/item-cursor-query.dto';
import { Item } from '../entities/item.entity';
import { IItemRepository } from '../interfaces/item-repository.interface';

const ALIAS_ITEM = 'item';
const item = col<Item>(ALIAS_ITEM);

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

@Injectable()
export class ItemRepository extends BaseRepository<Item> implements IItemRepository {
  constructor(
    @InjectRepository(Item)
    protected readonly repository: Repository<Item>,
  ) {
    super(repository);
  }

  async filter(query: ItemCursorQueryDto): Promise<PagCursorResultDto<Item>> {
    const { name, description, cursor } = query;
    const limit = cursor?.limit
      ? Math.min(cursor.limit, MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;

    const queryBuilder = this.createQueryBuilder(ALIAS_ITEM)
      .orderBy(item('createdAt'), 'DESC')
      .addOrderBy(item('id'), 'DESC')
      .take(limit + 1);

    if (name) {
      queryBuilder.andWhere(`${item('name')} ILIKE :name`, { name: `%${name}%` });
    }
    if (description) {
      queryBuilder.andWhere(`${item('description')} ILIKE :description`, {
        description: `%${description}%`,
      });
    }
    if (cursor?.startingAfter) {
      queryBuilder.andWhere(`${item('createdAt')} < :startingAfter`, {
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

  async findManyByIds(ids: string[]): Promise<Item[]> {
    if (!ids.length) return [];
    return this.repository.findBy({ id: In(ids) } as any);
  }

  async decrementStock(i: Item, quantity: number): Promise<void> {
    const manager = this.getManager();
    await manager.decrement(Item, { id: i.id }, 'stock', quantity);
  }

  async incrementStock(i: Item, quantity: number): Promise<void> {
    const manager = this.getManager();
    await manager.increment(Item, { id: i.id }, 'stock', quantity);
  }

  private encodeCursor(i: Item): string {
    return Buffer.from(
      JSON.stringify({ startingAfter: i.createdAt.toISOString() }),
    ).toString('base64');
  }
}
