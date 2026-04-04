import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { CacheService } from '../../cache/cache.service';
import { OutboxService } from '../../../shared/modules/outbox/outbox.service';
import { OrderRepository } from '../repositories/order.repository';
import { DataSource } from 'typeorm';
import Redlock from 'redlock';
import { ProcessPaymentOrderStrategy } from './process-payment-order.strategy';

describe('ProcessPaymentOrderStrategy', () => {
  let strategy: ProcessPaymentOrderStrategy;
  let cacheService: jest.Mocked<CacheService>;
  let outboxService: jest.Mocked<OutboxService>;
  let orderRepository: jest.Mocked<OrderRepository>;
  let dataSource: jest.Mocked<DataSource>;
  let logger: Logger;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessPaymentOrderStrategy,
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
        {
          provide: Redlock,
          useValue: { acquire: jest.fn(), release: jest.fn() },
        },
      ],
    }).compile();

    strategy = module.get<ProcessPaymentOrderStrategy>(ProcessPaymentOrderStrategy);
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
