import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { CacheService } from '../../cache/cache.service';
import { OutboxService } from '../../../shared/modules/outbox/outbox.service';
import { OrderRepository } from '../repositories/order.repository';
import { DataSource } from 'typeorm';
import { ShipOrderStrategy } from './ship-order.strategy';

describe('ShipOrderStrategy', () => {
  let strategy: ShipOrderStrategy;
  let cacheService: jest.Mocked<CacheService>;
  let outboxService: jest.Mocked<OutboxService>;
  let orderRepository: jest.Mocked<OrderRepository>;
  let dataSource: jest.Mocked<DataSource>;
  let logger: Logger;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShipOrderStrategy,
        {
          provide: CacheService,
          useValue: {
            hasKey: jest.fn(),
            setKey: jest.fn(),
            removeKey: jest.fn(),
          },
        },
        {
          provide: OutboxService,
          useValue: {
            add: jest.fn(),
          },
        },
        {
          provide: OrderRepository,
          useValue: {
            update: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {},
        },
      ],
    }).compile();

    strategy = module.get<ShipOrderStrategy>(ShipOrderStrategy);
    cacheService = module.get(CacheService);
    outboxService = module.get(OutboxService);
    orderRepository = module.get(OrderRepository);
    dataSource = module.get(DataSource);
    logger = new Logger();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });
});
