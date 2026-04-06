/*eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { RefundOrderJobStrategy } from './refund-order-job.strategy';
import { CacheService } from '../../../shared/modules/cache/cache.service';
import { OutboxService } from '@/shared/modules/outbox/outbox.service';
import { OrderRepository } from '../repositories/order.repository';
import { DataSource } from 'typeorm';
import Redlock from 'redlock';

describe(RefundOrderJobStrategy.name, () => {
  let strategy: RefundOrderJobStrategy;
  let cacheService: jest.Mocked<CacheService>;
  let outboxService: jest.Mocked<OutboxService>;
  let orderRepository: jest.Mocked<OrderRepository>;
  let dataSource: jest.Mocked<DataSource>;
  let redlock: jest.Mocked<Redlock>;

  beforeEach(async () => {
    cacheService = {
      get: jest.fn(),
      set: jest.fn(),
    } as any;

    outboxService = {
      add: jest.fn(),
    } as any;

    orderRepository = {
      getAndValidate: jest.fn(),
    } as any;

    dataSource = {} as any;
    redlock = {} as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefundOrderJobStrategy,
        { provide: CacheService, useValue: cacheService },
        { provide: OutboxService, useValue: outboxService },
        { provide: OrderRepository, useValue: orderRepository },
        { provide: DataSource, useValue: dataSource },
        { provide: Redlock, useValue: redlock },
      ],
    }).compile();

    strategy = module.get<RefundOrderJobStrategy>(RefundOrderJobStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });
});
