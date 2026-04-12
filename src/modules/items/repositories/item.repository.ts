/* eslint-disable @typescript-eslint/no-explicit-any */
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Item } from '../entities/item.entity';
import { BaseRepository } from '@/shared/repositories/base.repository';
import { Injectable } from '@nestjs/common';
import { PaginatedResultDto } from '@/shared/dto/paginated-result.dto';
import { col } from '@/shared/helpers/functions';
import { ItemQueryDto } from '../dto/item-query.dto';

const aliasItem = 'item';
const item = col<Item>(aliasItem);

@Injectable()
export class ItemRepository extends BaseRepository<Item> {
  constructor(
    @InjectRepository(Item)
    protected readonly repository: Repository<Item>,
  ) {
    super(repository);
  }

  async filter(query: Partial<ItemQueryDto>): Promise<PaginatedResultDto<Item>> {
    const queryBuilder = this.createQueryBuilder(aliasItem);

    if (query.name) {
      queryBuilder.andWhere(`${item('name')} ILIKE :name`, {
        name: `%${query.name}%`,
      });
    }
    if (query.description) {
      queryBuilder.andWhere(`${item('description')} ILIKE :description`, {
        description: `%${query.description}%`,
      });
    }

    const limit = query.limit ? Math.min(query.limit, 100) : 20;
    const skip = (query.page - 1) * limit;

    return queryBuilder
      .skip(skip)
      .take(limit)
      .orderBy(item('createdAt'), 'DESC')
      .getManyAndCount()
      .then(
        ([data, total]) => new PaginatedResultDto(total, query.page, limit, data),
      );
  }

  async findManyByIds(ids: string[]): Promise<Item[]> {
    if (!ids.length) return [];
    return this.repository.findBy({ id: In(ids) } as any);
  }

  async decrementStock(items: Item, quantity: number): Promise<void> {
    await this.repository.decrement({ id: items.id }, 'stock', quantity);
  }

  async incrementStock(items: Item, quantity: number): Promise<void> {
    await this.repository.increment({ id: items.id }, 'stock', quantity);
  }
}
