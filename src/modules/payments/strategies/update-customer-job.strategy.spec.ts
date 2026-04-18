import { Test, TestingModule } from '@nestjs/testing';
import { UpdateCustomerJobStrategy } from './update-customer-job.strategy';
import { CACHE_SERVICE } from '@/shared/modules/cache/constants/cache.tokens';
import { PAYMENTS_GATEWAY_SERVICE } from '@/modules/payments-gateway/constants/payments-gateway.tokens';
import { ORDER_REPOSITORY } from '@/modules/orders/constants/orders.tokens';
import { USER_REPOSITORY } from '@/modules/users/constants/users.tokens';
import { DataSource } from 'typeorm';
import Redlock from 'redlock';
import {
  createCacheServiceMock,
  createDataSourceMock,
  createRedlockMock,
} from '@/shared/testing/provider-mocks';

describe('UpdateCustomerJobStrategy', () => {
  let strategy: UpdateCustomerJobStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateCustomerJobStrategy,
        {
          provide: PAYMENTS_GATEWAY_SERVICE,
          useValue: { customersUpdate: jest.fn() },
        },
        {
          provide: CACHE_SERVICE,
          useValue: createCacheServiceMock(),
        },
        {
          provide: ORDER_REPOSITORY,
          useValue: { update: jest.fn(), findOne: jest.fn() },
        },
        {
          provide: USER_REPOSITORY,
          useValue: { update: jest.fn(), findById: jest.fn() },
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

    strategy = module.get<UpdateCustomerJobStrategy>(UpdateCustomerJobStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });
});
