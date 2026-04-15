/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { ItemsService } from './items.service';
import { ItemRepository } from './repositories/item.repository';
import { CacheService } from '@/shared/modules/cache/cache.service';
import { DataSource } from 'typeorm';
import Redlock from 'redlock';

describe('ItemsService', () => {
  let service: ItemsService;
  let itemRepository: jest.Mocked<ItemRepository>;
  let cacheService: jest.Mocked<CacheService>;
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
        ItemsService,
        { provide: ItemRepository, useValue: itemRepository },
        { provide: CacheService, useValue: cacheService },
        { provide: DataSource, useValue: dataSource },
        { provide: Redlock, useValue: redlock },
      ],
    }).compile();

    service = module.get<ItemsService>(ItemsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
