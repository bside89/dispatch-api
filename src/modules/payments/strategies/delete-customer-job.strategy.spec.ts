import { Test, TestingModule } from '@nestjs/testing';
import { DeleteCustomerJobStrategy } from './delete-customer-job.strategy';
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

describe('DeleteCustomerJobStrategy', () => {
  let strategy: DeleteCustomerJobStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteCustomerJobStrategy,
        {
          provide: PAYMENTS_GATEWAY_SERVICE,
          useValue: { customersDelete: jest.fn() },
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
          useValue: { findById: jest.fn(), update: jest.fn() },
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

    strategy = module.get<DeleteCustomerJobStrategy>(DeleteCustomerJobStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });
});
