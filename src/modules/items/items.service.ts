import { Injectable, NotFoundException } from '@nestjs/common';
import { ItemRepository } from './repositories/item.repository';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ItemQueryDto, PublicItemQueryDto } from './dto/item-query.dto';
import { ItemResponseDto, PublicItemResponseDto } from './dto/item-response.dto';
import { PaginatedResultDto } from '@/shared/dto/paginated-result.dto';
import { EntityMapper } from '@/shared/utils/entity-mapper';
import { Item } from './entities/item.entity';
import Redlock from 'redlock';
import { DataSource } from 'typeorm';
import { UseLock } from '@/shared/decorators/lock.decorator';
import { Transactional } from '@/shared/decorators/transactional.decorator';
import { CacheService } from '@/shared/modules/cache/cache.service';
import { ITEM_KEY } from '@/shared/modules/cache/constants/item.key';
import { CACHE_TTL } from '@/shared/constants/cache-ttl.constant';
import { runAndIgnoreError, template } from '@/shared/helpers/functions';
import { LOCK_PREFIX } from '@/shared/constants/lock-prefix.constant';
import { TransactionalService } from '@/shared/services/transactional.service';
import { I18N_ITEM } from '@/shared/constants/i18n';

@Injectable()
export class ItemsService extends TransactionalService {
  constructor(
    private readonly itemRepository: ItemRepository,
    private readonly cacheService: CacheService,
    dataSource: DataSource,
    redlock: Redlock,
  ) {
    super(ItemsService.name, dataSource, redlock);
  }

  // #region Public endpoints

  async publicFindAll(
    query: PublicItemQueryDto,
  ): Promise<PaginatedResultDto<PublicItemResponseDto>> {
    const cacheKey = ITEM_KEY.CACHE_FIND_ALL(query);
    const cachedResult = await runAndIgnoreError(
      () =>
        this.cacheService.get<PaginatedResultDto<PublicItemResponseDto>>(cacheKey),
      `fetching items list from cache with key: ${cacheKey}`,
      this.logger,
    );
    if (cachedResult) {
      this.logger.debug('Returning cached items list', { cacheKey });
      return cachedResult;
    }

    const result = await this.itemRepository.filter(query);
    const resultMapped = new PaginatedResultDto<PublicItemResponseDto>(
      result.total,
      result.page,
      result.limit,
      EntityMapper.mapArray(result.data, PublicItemResponseDto),
    );

    await runAndIgnoreError(
      () => this.cacheService.set(cacheKey, resultMapped, CACHE_TTL.LIST),
      `caching items list with key: ${cacheKey}`,
      this.logger,
    );

    this.logger.debug(`Retrieved ${result.data.length} items`, { cacheKey });

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
      throw new NotFoundException(template(I18N_ITEM.ERRORS.NOT_FOUND));
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

  @Transactional()
  @UseLock({
    prefix: LOCK_PREFIX.ITEM.CREATE,
    key: ([, idempotencyKey]) => idempotencyKey,
  })
  async adminCreate(
    dto: CreateItemDto,
    idempotencyKey: string,
  ): Promise<ItemResponseDto> {
    /** 1. VALIDATION AND IDEMPOTENCY CHECK */

    const idempotencyKeyFormatted = ITEM_KEY.IDEMPOTENCY(
      this.adminCreate.name,
      idempotencyKey,
    );
    const existingItem = await this.cacheService.get<ItemResponseDto>(
      idempotencyKeyFormatted,
    );
    if (existingItem) {
      this.logger.debug('Returning existing item for idempotency key', {
        idempotencyKey: idempotencyKeyFormatted,
        itemId: existingItem.id,
      });
      return existingItem;
    }

    /** 2. CREATE ITEM */

    const item = this.itemRepository.createEntity(dto);
    const savedItem = await this.itemRepository.save(item);
    const itemResponse = EntityMapper.map(savedItem, ItemResponseDto);

    /** 3. CACHE ITEM */

    await this.cacheService.set(
      idempotencyKeyFormatted,
      itemResponse,
      CACHE_TTL.IDEMPOTENCY,
    );

    await this.cacheService.deleteBulk({
      patterns: [ITEM_KEY.CACHE_FIND_ALL_PATTERN()],
    });

    this.logger.debug('Item created and cached', {
      itemId: savedItem.id,
      idempotencyKey: idempotencyKeyFormatted,
    });

    return itemResponse;
  }

  async adminFindAll(
    query: ItemQueryDto,
  ): Promise<PaginatedResultDto<ItemResponseDto>> {
    const cacheKey = ITEM_KEY.CACHE_FIND_ALL(query);
    const cachedResult = await runAndIgnoreError(
      () => this.cacheService.get<PaginatedResultDto<ItemResponseDto>>(cacheKey),
      `fetching items list from cache with key: ${cacheKey}`,
      this.logger,
    );
    if (cachedResult) {
      this.logger.debug('Returning cached items list', { cacheKey });
      return cachedResult;
    }

    const result = await this.itemRepository.filter(query);
    const resultMapped = new PaginatedResultDto<ItemResponseDto>(
      result.total,
      result.page,
      result.limit,
      EntityMapper.mapArray(result.data, ItemResponseDto),
    );

    await runAndIgnoreError(
      () => this.cacheService.set(cacheKey, resultMapped, CACHE_TTL.LIST),
      `caching items list with key: ${cacheKey}`,
      this.logger,
    );

    this.logger.debug(`Retrieved ${result.data.length} items`, { cacheKey });

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
      throw new NotFoundException(template(I18N_ITEM.ERRORS.NOT_FOUND));
    }
    const itemMapped = EntityMapper.map(item, ItemResponseDto);

    await runAndIgnoreError(
      () => this.cacheService.set(cacheKey, itemMapped, CACHE_TTL.LIST),
      `caching item with ID: ${id}`,
      this.logger,
    );

    return itemMapped;
  }

  @Transactional()
  @UseLock({ prefix: LOCK_PREFIX.ITEM.UPDATE, key: ([id]) => id })
  async adminUpdate(id: string, dto: UpdateItemDto): Promise<ItemResponseDto> {
    const item = await this.itemRepository.findById(id);
    if (!item) {
      throw new NotFoundException(template(I18N_ITEM.ERRORS.NOT_FOUND));
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

  @Transactional()
  @UseLock({ prefix: LOCK_PREFIX.ITEM.REMOVE, key: ([id]) => id })
  async adminRemove(id: string): Promise<void> {
    this.logger.debug('Deactivating item', { itemId: id });

    const item = await this.itemRepository.findById(id);
    if (!item) {
      throw new NotFoundException(template(I18N_ITEM.ERRORS.NOT_FOUND));
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

  @Transactional()
  @UseLock({ prefix: LOCK_PREFIX.ITEM.UPDATE, key: ([item]) => item.id })
  async decrementItemStock(item: Item, quantity: number): Promise<void> {
    await this.itemRepository.decrementStock(item, quantity);
  }

  @Transactional()
  @UseLock({ prefix: LOCK_PREFIX.ITEM.UPDATE, key: ([item]) => item.id })
  async incrementItemStock(item: Item, quantity: number): Promise<void> {
    await this.itemRepository.incrementStock(item, quantity);
  }

  // #endregion
}
