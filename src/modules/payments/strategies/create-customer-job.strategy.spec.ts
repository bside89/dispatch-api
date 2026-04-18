import { Test, TestingModule } from '@nestjs/testing';
import { CreateCustomerJobStrategy } from './create-customer-job.strategy';
import { CACHE_SERVICE } from '@/shared/modules/cache/constants/cache.tokens';
import { PAYMENTS_GATEWAY_SERVICE } from '@/modules/payments-gateway/constants/payments-gateway.tokens';
import { ORDER_REPOSITORY } from '@/modules/orders/constants/orders.tokens';
import { USER_REPOSITORY } from '@/modules/users/constants/users.tokens';
import { DataSource } from 'typeorm';
import Redlock from 'redlock';

describe('CreateCustomerJobStrategy', () => {
  let strategy: CreateCustomerJobStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateCustomerJobStrategy,
        {
          provide: PAYMENTS_GATEWAY_SERVICE,
          useValue: { customersCreate: jest.fn() },
        },
        {
          provide: CACHE_SERVICE,
          useValue: { get: jest.fn(), set: jest.fn() },
        },
        {
          provide: ORDER_REPOSITORY,
          useValue: { findOne: jest.fn() },
        },
        {
          provide: USER_REPOSITORY,
          useValue: { findOne: jest.fn(), save: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: { transaction: jest.fn() },
        },
        {
          provide: Redlock,
          useValue: { lock: jest.fn() },
        },
      ],
    }).compile();

    strategy = module.get<CreateCustomerJobStrategy>(CreateCustomerJobStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });
});
