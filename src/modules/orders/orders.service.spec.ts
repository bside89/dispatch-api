import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { OrderRepository } from './repositories/order.repository';
import { OrderItemRepository } from './repositories/order-item.repository';
import { CacheService } from '../cache/cache.service';
import { OutboxService } from '../../shared/modules/outbox/outbox.service';
import { DataSource } from 'typeorm';

describe('OrdersService', () => {
  let service: OrdersService;
  let orderRepository: jest.Mocked<OrderRepository>;
  let orderItemRepository: jest.Mocked<OrderItemRepository>;
  let cacheService: jest.Mocked<CacheService>;
  let outboxService: jest.Mocked<OutboxService>;
  let dataSource: jest.Mocked<DataSource>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: OrderRepository,
          useValue: {
            createEntity: jest.fn(),
            save: jest.fn(),
            findOneWithRelations: jest.fn(),
            findAllWithFilters: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: OrderItemRepository,
          useValue: {
            createEntity: jest.fn(),
            saveMany: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            delete: jest.fn(),
            deletePattern: jest.fn(),
          },
        },
        {
          provide: OutboxService,
          useValue: {
            add: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    orderRepository = module.get(
      OrderRepository,
    ) as jest.Mocked<OrderRepository>;
    orderItemRepository = module.get(
      OrderItemRepository,
    ) as jest.Mocked<OrderItemRepository>;
    cacheService = module.get(CacheService) as jest.Mocked<CacheService>;
    outboxService = module.get(OutboxService) as jest.Mocked<OutboxService>;
    dataSource = module.get(DataSource) as jest.Mocked<DataSource>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
