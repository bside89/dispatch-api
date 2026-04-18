import { Test, TestingModule } from '@nestjs/testing';
import { CancelOrderJobStrategy } from './cancel-order-job.strategy';
import { CACHE_SERVICE } from '../../../shared/modules/cache/constants/cache.token';
import { OUTBOX_SERVICE } from '../../../shared/modules/outbox/constants/outbox.token';
import { ITEMS_SERVICE } from '../../items/constants/items.token';
import { ORDER_REPOSITORY } from '../constants/orders.token';
import { DataSource } from 'typeorm';
import Redlock from 'redlock';
import {
  createCacheServiceMock,
  createDataSourceMock,
  createOutboxServiceMock,
  createRedlockMock,
} from '@/shared/testing/provider-mocks';
import { OrderMessageFactory } from '../factories/order-message.factory';

describe('CancelOrderJobStrategy', () => {
  let strategy: CancelOrderJobStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CancelOrderJobStrategy,
        {
          provide: CACHE_SERVICE,
          useValue: createCacheServiceMock(),
        },
        {
          provide: OUTBOX_SERVICE,
          useValue: createOutboxServiceMock(),
        },
        {
          provide: ITEMS_SERVICE,
          useValue: {
            findManyByIds: jest.fn(),
            incrementItemStock: jest.fn(),
          },
        },
        {
          provide: OrderMessageFactory,
          useValue: {},
        },
        {
          provide: ORDER_REPOSITORY,
          useValue: {
            update: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: createDataSourceMock(),
        },
        {
          provide: Redlock,
          useValue: createRedlockMock(),
        },
      ],
    }).compile();

    strategy = module.get<CancelOrderJobStrategy>(CancelOrderJobStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });
});
