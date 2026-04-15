/*eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { RefundOrderJobStrategy } from './refund-order-job.strategy';
import { CacheService } from '../../../shared/modules/cache/cache.service';
import { OutboxService } from '@/shared/modules/outbox/outbox.service';
import { OrderRepository } from '../repositories/order.repository';
import { DataSource } from 'typeorm';
import Redlock from 'redlock';
import {
  createCacheServiceMock,
  createDataSourceMock,
  createOutboxServiceMock,
  createRedlockMock,
} from '@/shared/testing/provider-mocks';
import { OrderMessageFactory } from '../factories/order-message.factory';

describe('RefundOrderJobStrategy', () => {
  let strategy: RefundOrderJobStrategy;
  let cacheService: jest.Mocked<CacheService>;
  let outboxService: jest.Mocked<OutboxService>;
  let orderRepository: jest.Mocked<OrderRepository>;
  let messages: jest.Mocked<OrderMessageFactory>;
  let dataSource: jest.Mocked<DataSource>;
  let redlock: jest.Mocked<Redlock>;

  beforeEach(async () => {
    cacheService = createCacheServiceMock() as any;

    outboxService = createOutboxServiceMock() as any;

    messages = {
      notifications: {
        orderRefunded: jest.fn(),
      },
    } as any;

    orderRepository = {
      getAndValidate: jest.fn(),
    } as any;

    dataSource = createDataSourceMock() as any;
    redlock = createRedlockMock() as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefundOrderJobStrategy,
        { provide: CacheService, useValue: cacheService },
        { provide: OutboxService, useValue: outboxService },
        { provide: OrderRepository, useValue: orderRepository },
        { provide: DataSource, useValue: dataSource },
        { provide: Redlock, useValue: redlock },
        { provide: OrderMessageFactory, useValue: messages },
      ],
    }).compile();

    strategy = module.get<RefundOrderJobStrategy>(RefundOrderJobStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });
});
