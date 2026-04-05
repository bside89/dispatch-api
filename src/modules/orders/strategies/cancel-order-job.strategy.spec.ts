import { Test, TestingModule } from '@nestjs/testing';
import { CancelOrderJobStrategy as CancelOrderJobStrategy } from './cancel-order-job.strategy';
import { CacheService } from '../../../shared/modules/cache/cache.service';
import { OutboxService } from '../../../shared/modules/outbox/outbox.service';
import { OrderRepository } from '../repositories/order.repository';
import { DataSource } from 'typeorm';
import Redlock from 'redlock';

describe(CancelOrderJobStrategy.name, () => {
  let strategy: CancelOrderJobStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CancelOrderJobStrategy,
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

    strategy = module.get<CancelOrderJobStrategy>(CancelOrderJobStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });
});
