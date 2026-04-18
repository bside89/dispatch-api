import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_SERVICE } from '../../../shared/modules/cache/constants/cache.tokens';
import { OUTBOX_SERVICE } from '../../../shared/modules/outbox/constants/outbox.tokens';
import { ORDER_REPOSITORY } from '../constants/orders.tokens';
import { DataSource } from 'typeorm';
import Redlock from 'redlock';
import { ProcessOrderJobStrategy } from './process-order-job.strategy';
import { OrderMessageFactory } from '../factories/order-message.factory';

describe('ProcessOrderJobStrategy', () => {
  let strategy: ProcessOrderJobStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessOrderJobStrategy,
        {
          provide: CACHE_SERVICE,
          useValue: {
            hasKey: jest.fn(),
            setKey: jest.fn(),
            removeKey: jest.fn(),
          },
        },
        {
          provide: OUTBOX_SERVICE,
          useValue: {
            add: jest.fn(),
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
          useValue: {},
        },
        {
          provide: Redlock,
          useValue: { acquire: jest.fn(), release: jest.fn() },
        },
      ],
    }).compile();

    strategy = module.get<ProcessOrderJobStrategy>(ProcessOrderJobStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });
});
