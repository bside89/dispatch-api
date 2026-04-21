import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import type { IItemRepository } from './interfaces/item-repository.interface';
import { ITEM_REPOSITORY } from './constants/items.token';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ItemQueryDto, PublicItemQueryDto } from './dto/item-query.dto';
import { ItemResponseDto, PublicItemResponseDto } from './dto/item-response.dto';
import { PagOffsetResultDto } from '@/shared/dto/pag-offset-result.dto';
import { EntityMapper } from '@/shared/utils/entity-mapper.utils';
import { Item } from './entities/item.entity';
import type { ICacheService } from '@/shared/modules/cache/interfaces/cache-service.interface';
import { CACHE_SERVICE } from '@/shared/modules/cache/constants/cache.token';
import { IDEMPOTENCY_SERVICE } from '@/shared/modules/cache/constants/idempotency.token';
import type { IIdempotencyService } from '@/shared/modules/cache/interfaces/idempotency-service.interface';
import { ITEM_KEY } from '@/shared/modules/cache/constants/item.key';
import { CACHE_TTL } from '@/shared/constants/cache-ttl.constant';
import { runAndIgnoreError, template } from '@/shared/utils/functions.utils';
import { LOCK_KEY } from '@/shared/constants/lock.key';
import { I18N_ITEMS } from '@/shared/constants/i18n';
import { IItemsService } from './interfaces/items-service.interface';
import { BaseService } from '@/shared/services/base.service';
import { DbGuardService } from '@/shared/modules/db-guard/db-guard.service';

@Injectable()
export class ItemsService extends BaseService implements IItemsService {
  constructor(
    @Inject(ITEM_REPOSITORY) private readonly itemRepository: IItemRepository,
    @Inject(CACHE_SERVICE) private readonly cacheService: ICacheService,
    @Inject(IDEMPOTENCY_SERVICE)
    private readonly idempotencyService: IIdempotencyService,
    private readonly guard: DbGuardService,
  ) {
    super(ItemsService.name);
  }

  // #region Public endpoints

  async publicFindAll(
    query: PublicItemQueryDto,
  ): Promise<PagOffsetResultDto<PublicItemResponseDto>> {
    const cacheKey = ITEM_KEY.CACHE_FIND_ALL(query);
    const cachedResult = await runAndIgnoreError(
      () =>
        this.cacheService.get<PagOffsetResultDto<PublicItemResponseDto>>(cacheKey),
      `fetching items list from cache with key: ${cacheKey}`,
      this.logger,
    );
    if (cachedResult) {
      this.logger.debug('Returning cached items list', { cacheKey });
      return cachedResult;
    }

    const result = await this.itemRepository.filter(query);
    const resultMapped = new PagOffsetResultDto<PublicItemResponseDto>(
      result.meta.total,
      result.meta.page,
      result.meta.limit,
      EntityMapper.mapArray(result.items, PublicItemResponseDto),
    );

    await runAndIgnoreError(
      () => this.cacheService.set(cacheKey, resultMapped, CACHE_TTL.LIST),
      `caching items list with key: ${cacheKey}`,
      this.logger,
    );

    this.logger.debug(`Retrieved ${result.items.length} items`, { cacheKey });

    return resultMapped;
  }

  async publicFindOne(id: string): Promise<PublicItemResponseDto> {
    const cacheKey = ITEM_KEY.CACHE_FIND_ONE(id);
    const cachedResult = await runAndIgnoreError(
      () => this.cacheService.get<PublicItemResponseDto>(cacheKey),
      `fetching item from cache with key: ${cacheKey}`,
      this.logger,
    );
    if (cachedResult) {
      this.logger.debug('Returning cached item', { id });
      return cachedResult;
    }

    const item = await this.itemRepository.findById(id);
    if (!item) {
      throw new NotFoundException(template(I18N_ITEMS.ERRORS.NOT_FOUND));
    }
    const itemMapped = EntityMapper.map(item, PublicItemResponseDto);

    await runAndIgnoreError(
      () => this.cacheService.set(cacheKey, itemMapped, CACHE_TTL.LIST),
      `caching item with ID: ${id}`,
      this.logger,
    );

    return itemMapped;
  }

  // #endregion

  // #region Admin endpoints

  adminCreate(dto: CreateItemDto, idempotencyKey: string): Promise<ItemResponseDto> {
    return this.guard.lockAndTransaction(
      LOCK_KEY.ITEM.CREATE(idempotencyKey),
      async () => this._adminCreate(dto, idempotencyKey),
    );
  }

  private async _adminCreate(
    dto: CreateItemDto,
    idempotencyKey: string,
  ): Promise<ItemResponseDto> {
    /** 1. VALIDATION AND IDEMPOTENCY CHECK */

    const idempotencyKeyFormatted = ITEM_KEY.IDEMPOTENCY(
      this.adminCreate.name,
      idempotencyKey,
    );

    return this.idempotencyService.getOrExecute(
      idempotencyKeyFormatted,
      async () => {
        /** 2. CREATE ITEM */

        const item = this.itemRepository.createEntity(dto);
        const savedItem = await this.itemRepository.save(item);
        const itemResponse = EntityMapper.map(savedItem, ItemResponseDto);

        /** 3. CACHE ITEM */

        await this.cacheService.deleteBulk({
          patterns: [ITEM_KEY.CACHE_FIND_ALL_PATTERN()],
        });

        this.logger.debug('Item created', {
          itemId: savedItem.id,
          idempotencyKey: idempotencyKeyFormatted,
        });

        return itemResponse;
      },
    );
  }

  async adminFindAll(
    query: ItemQueryDto,
  ): Promise<PagOffsetResultDto<ItemResponseDto>> {
    const cacheKey = ITEM_KEY.CACHE_FIND_ALL(query);
    const cachedResult = await runAndIgnoreError(
      () => this.cacheService.get<PagOffsetResultDto<ItemResponseDto>>(cacheKey),
      `fetching items list from cache with key: ${cacheKey}`,
      this.logger,
    );
    if (cachedResult) {
      this.logger.debug('Returning cached items list', { cacheKey });
      return cachedResult;
    }

    const result = await this.itemRepository.filter(query);
    const resultMapped = new PagOffsetResultDto<ItemResponseDto>(
      result.meta.total,
      result.meta.page,
      result.meta.limit,
      EntityMapper.mapArray(result.items, ItemResponseDto),
    );

    await runAndIgnoreError(
      () => this.cacheService.set(cacheKey, resultMapped, CACHE_TTL.LIST),
      `caching items list with key: ${cacheKey}`,
      this.logger,
    );

    this.logger.debug(`Retrieved ${result.items.length} items`, { cacheKey });

    return resultMapped;
  }

  async adminFindOne(id: string): Promise<ItemResponseDto> {
    const cacheKey = ITEM_KEY.CACHE_FIND_ONE(id);
    const cachedResult = await runAndIgnoreError(
      () => this.cacheService.get<ItemResponseDto>(cacheKey),
      `fetching item from cache with key: ${cacheKey}`,
      this.logger,
    );
    if (cachedResult) {
      this.logger.debug('Returning cached item', { id });
      return cachedResult;
    }

    this.logger.debug('Fetching item', { itemId: id });

    const item = await this.itemRepository.findById(id);
    if (!item) {
      throw new NotFoundException(template(I18N_ITEMS.ERRORS.NOT_FOUND));
    }
    const itemMapped = EntityMapper.map(item, ItemResponseDto);

    await runAndIgnoreError(
      () => this.cacheService.set(cacheKey, itemMapped, CACHE_TTL.LIST),
      `caching item with ID: ${id}`,
      this.logger,
    );

    return itemMapped;
  }

  adminUpdate(id: string, dto: UpdateItemDto): Promise<ItemResponseDto> {
    return this.guard.lockAndTransaction(LOCK_KEY.ITEM.UPDATE(id), async () =>
      this._adminUpdate(id, dto),
    );
  }

  private async _adminUpdate(
    id: string,
    dto: UpdateItemDto,
  ): Promise<ItemResponseDto> {
    const item = await this.itemRepository.findById(id);
    if (!item) {
      throw new NotFoundException(template(I18N_ITEMS.ERRORS.NOT_FOUND));
    }

    Object.assign(item, dto);
    const savedItem = await this.itemRepository.save(item);

    this.logger.debug('Item updated', { itemId: savedItem.id });

    await this.cacheService.deleteBulk({
      keys: [ITEM_KEY.CACHE_FIND_ONE(id)],
      patterns: [ITEM_KEY.CACHE_FIND_ALL_PATTERN()],
    });

    return EntityMapper.map(savedItem, ItemResponseDto);
  }

  adminRemove(id: string): Promise<void> {
    return this.guard.lockAndTransaction(LOCK_KEY.ITEM.REMOVE(id), async () =>
      this._adminRemove(id),
    );
  }

  private async _adminRemove(id: string): Promise<void> {
    const item = await this.itemRepository.findById(id);
    if (!item) {
      throw new NotFoundException(template(I18N_ITEMS.ERRORS.NOT_FOUND));
    }

    await this.itemRepository.softDelete(item);

    await this.cacheService.deleteBulk({
      keys: [ITEM_KEY.CACHE_FIND_ONE(id)],
      patterns: [ITEM_KEY.CACHE_FIND_ALL_PATTERN()],
    });

    this.logger.debug('Item deactivated', { itemId: id });
  }

  // #endregion

  // #region Misc methods

  async findManyByIds(ids: string[]): Promise<Item[]> {
    return this.itemRepository.findManyByIds(ids);
  }

  decrementItemStock(item: Item, quantity: number): Promise<void> {
    if (item.stock < quantity) {
      throw new ForbiddenException(
        template(I18N_ITEMS.ERRORS.INSUFFICIENT_STOCK, { itemName: item.name }),
      );
    }
    return this.guard.lockAndTransaction(LOCK_KEY.ITEM.UPDATE(item.id), async () =>
      this.itemRepository.decrementStock(item, quantity),
    );
  }

  incrementItemStock(item: Item, quantity: number): Promise<void> {
    return this.guard.lockAndTransaction(LOCK_KEY.ITEM.UPDATE(item.id), async () =>
      this.itemRepository.incrementStock(item, quantity),
    );
  }

  async validateAndGetCatalogItems(ids: string[]): Promise<Item[]> {
    const catalogItems = await this.findManyByIds(ids);
    // Validate all items exist in catalog
    for (const id of ids) {
      if (!catalogItems.find((ci) => ci.id === id)) {
        throw new NotFoundException(template(I18N_ITEMS.ERRORS.NOT_FOUND));
      }
    }
    return catalogItems;
  }

  // #endregion
}
