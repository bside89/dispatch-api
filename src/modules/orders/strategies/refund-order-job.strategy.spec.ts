/*eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { RefundOrderJobStrategy } from './refund-order-job.strategy';
import { CACHE_SERVICE } from '../../../shared/modules/cache/constants/cache.tokens';
import { OUTBOX_SERVICE } from '@/shared/modules/outbox/constants/outbox.tokens';
import { ORDER_REPOSITORY } from '../constants/orders.tokens';
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
  let cacheService: jest.Mocked<any>;
  let outboxService: jest.Mocked<any>;
  let orderRepository: jest.Mocked<any>;
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
        { provide: CACHE_SERVICE, useValue: cacheService },
        { provide: OUTBOX_SERVICE, useValue: outboxService },
        { provide: ORDER_REPOSITORY, useValue: orderRepository },
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
