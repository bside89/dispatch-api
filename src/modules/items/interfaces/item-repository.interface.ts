import { PagCursorResultDto } from '@/shared/dto/pag-cursor-result.dto';
import { IBaseRepository } from '@/shared/repositories/base-repository.interface';
import { ItemCursorQueryDto } from '../dto/item-cursor-query.dto';
import { Item } from '../entities/item.entity';

export interface IItemRepository extends IBaseRepository<Item> {
  filter(query: ItemCursorQueryDto): Promise<PagCursorResultDto<Item>>;

  findManyByIds(ids: string[]): Promise<Item[]>;

  decrementStock(item: Item, quantity: number): Promise<void>;

  incrementStock(item: Item, quantity: number): Promise<void>;
}
