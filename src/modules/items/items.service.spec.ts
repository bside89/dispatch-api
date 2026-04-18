/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { ItemsService } from './items.service';
import { ITEMS_SERVICE, ITEM_REPOSITORY } from './constants/items.tokens';
import { CACHE_SERVICE } from '@/shared/modules/cache/constants/cache.tokens';
import { DataSource } from 'typeorm';
import Redlock from 'redlock';

describe('ItemsService', () => {
  let service: ItemsService;
  let itemRepository: jest.Mocked<any>;
  let cacheService: jest.Mocked<any>;
  let dataSource: jest.Mocked<DataSource>;
  let redlock: jest.Mocked<Redlock>;

  beforeEach(async () => {
    itemRepository = {
      createEntity: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      filter: jest.fn(),
      findManyByIds: jest.fn(),
      deleteById: jest.fn(),
      decrementStock: jest.fn(),
      incrementStock: jest.fn(),
    } as any;

    cacheService = {
      get: jest.fn(),
      set: jest.fn(),
      deleteBulk: jest.fn(),
    } as any;

    dataSource = {} as any;
    redlock = {} as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: ITEMS_SERVICE, useClass: ItemsService },
        { provide: ITEM_REPOSITORY, useValue: itemRepository },
        { provide: CACHE_SERVICE, useValue: cacheService },
        { provide: DataSource, useValue: dataSource },
        { provide: Redlock, useValue: redlock },
      ],
    }).compile();

    service = module.get<ItemsService>(ITEMS_SERVICE);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
