import { IBaseRepository } from '@/shared/repositories/base-repository.interface';
import { PagOffsetResultDto } from '@/shared/dto/pag-offset-result.dto';
import { Item } from '../entities/item.entity';
import { ItemQueryDto } from '../dto/item-query.dto';

export interface IItemRepository extends IBaseRepository<Item> {
  filter(query: Partial<ItemQueryDto>): Promise<PagOffsetResultDto<Item>>;

  findManyByIds(ids: string[]): Promise<Item[]>;

  decrementStock(item: Item, quantity: number): Promise<void>;

  incrementStock(item: Item, quantity: number): Promise<void>;
}
