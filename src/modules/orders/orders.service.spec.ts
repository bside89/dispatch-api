import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { OrderRepository } from './repositories/order.repository';
import { OrderItemRepository } from './repositories/order-item.repository';
import { CacheService } from '../../shared/modules/cache/cache.service';
import { OutboxService } from '../../shared/modules/outbox/outbox.service';
import { DataSource } from 'typeorm';
import Redlock from 'redlock';
import { ItemRepository } from '../items/repositories/item.repository';

describe('OrdersService', () => {
  let service: OrdersService;
  let orderRepository: { filter: jest.Mock; findOne: jest.Mock };
  let cacheService: { get: jest.Mock; set: jest.Mock; deleteBulk: jest.Mock };

  beforeEach(async () => {
    orderRepository = {
      filter: jest.fn(),
      findOne: jest.fn(),
    };

    cacheService = {
      get: jest.fn(),
      set: jest.fn(),
      deleteBulk: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: OrderRepository,
          useValue: orderRepository,
        },
        {
          provide: OrderItemRepository,
          useValue: {
            createEntity: jest.fn(),
            saveBulk: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: cacheService,
        },
        {
          provide: OutboxService,
          useValue: {
            add: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {},
        },
        {
          provide: Redlock,
          useValue: { acquire: jest.fn(), release: jest.fn() },
        },
        {
          provide: ItemRepository,
          useValue: {
            findManyByIds: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
