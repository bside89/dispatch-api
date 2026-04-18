import { PaginatedResultDto } from '@/shared/dto/paginated-result.dto';
import { CreateItemDto } from '../dto/create-item.dto';
import { UpdateItemDto } from '../dto/update-item.dto';
import { ItemQueryDto, PublicItemQueryDto } from '../dto/item-query.dto';
import { ItemResponseDto, PublicItemResponseDto } from '../dto/item-response.dto';
import { Item } from '../entities/item.entity';

export interface IItemsService {
  publicFindAll(
    query: PublicItemQueryDto,
  ): Promise<PaginatedResultDto<PublicItemResponseDto>>;

  publicFindOne(id: string): Promise<PublicItemResponseDto>;

  adminCreate(dto: CreateItemDto, idempotencyKey: string): Promise<ItemResponseDto>;

  adminFindAll(query: ItemQueryDto): Promise<PaginatedResultDto<ItemResponseDto>>;

  adminFindOne(id: string): Promise<ItemResponseDto>;

  adminUpdate(id: string, dto: UpdateItemDto): Promise<ItemResponseDto>;

  adminRemove(id: string): Promise<void>;

  findManyByIds(ids: string[]): Promise<Item[]>;

  decrementItemStock(item: Item, quantity: number): Promise<void>;

  incrementItemStock(item: Item, quantity: number): Promise<void>;
}
