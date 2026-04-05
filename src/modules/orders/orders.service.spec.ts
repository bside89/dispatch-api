import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { OrderRepository } from './repositories/order.repository';
import { OrderItemRepository } from './repositories/order-item.repository';
import { CacheService } from '../../shared/modules/cache/cache.service';
import { OutboxService } from '../../shared/modules/outbox/outbox.service';
import { DataSource } from 'typeorm';
import Redlock from 'redlock';

describe('OrdersService', () => {
  let service: OrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: OrderRepository,
          useValue: {},
        },
        {
          provide: OrderItemRepository,
          useValue: {},
        },
        {
          provide: CacheService,
          useValue: {},
        },
        {
          provide: OutboxService,
          useValue: {},
        },
        {
          provide: DataSource,
          useValue: {},
        },
        {
          provide: Redlock,
          useValue: { acquire: jest.fn(), release: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
