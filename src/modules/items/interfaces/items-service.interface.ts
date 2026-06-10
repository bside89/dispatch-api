import { PagCursorResultDto } from '@/shared/dto/pag-cursor-result.dto';
import { IBaseService } from '@/shared/providers/services/base-service.interface';
import type { CursorParams } from '@/shared/types/cursor-params.type';
import { CreateItemDto } from '../dto/create-item.dto';
import { ItemQueryDto, PublicItemQueryDto } from '../dto/item-query.dto';
import { ItemResponseDto, PublicItemResponseDto } from '../dto/item-response.dto';
import { UpdateItemDto } from '../dto/update-item.dto';
import { Item } from '../entities/item.entity';

export interface IItemsService extends IBaseService {
  publicFindAll(
    query: PublicItemQueryDto,
    cursor?: CursorParams,
  ): Promise<PagCursorResultDto<PublicItemResponseDto>>;

  publicFindOne(id: string): Promise<PublicItemResponseDto>;

  adminCreate(dto: CreateItemDto, idempotencyKey: string): Promise<ItemResponseDto>;

  adminFindAll(
    query: ItemQueryDto,
    cursor?: CursorParams,
  ): Promise<PagCursorResultDto<ItemResponseDto>>;

  adminFindOne(id: string): Promise<ItemResponseDto>;

  adminUpdate(id: string, dto: UpdateItemDto): Promise<ItemResponseDto>;

  adminRemove(id: string): Promise<void>;

  findManyByIds(ids: string[]): Promise<Item[]>;

  decrementItemStock(item: Item, quantity: number): Promise<void>;

  incrementItemStock(item: Item, quantity: number): Promise<void>;

  validateAndGetCatalogItems(ids: string[]): Promise<Item[]>;
}
