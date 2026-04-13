import { Test, TestingModule } from '@nestjs/testing';
import { CancelOrderJobStrategy as CancelOrderJobStrategy } from './cancel-order-job.strategy';
import { CacheService } from '../../../shared/modules/cache/cache.service';
import { OutboxService } from '../../../shared/modules/outbox/outbox.service';
import { OrderRepository } from '../repositories/order.repository';
import { DataSource } from 'typeorm';
import Redlock from 'redlock';
import { ItemsService } from '../../items/items.service';
import {
  createCacheServiceMock,
  createDataSourceMock,
  createOutboxServiceMock,
  createRedlockMock,
} from '@/shared/testing/provider-mocks';

describe('CancelOrderJobStrategy', () => {
  let strategy: CancelOrderJobStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CancelOrderJobStrategy,
        {
          provide: CacheService,
          useValue: createCacheServiceMock(),
        },
        {
          provide: OutboxService,
          useValue: createOutboxServiceMock(),
        },
        {
          provide: ItemsService,
          useValue: {
            findManyByIds: jest.fn(),
            incrementItemStock: jest.fn(),
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
