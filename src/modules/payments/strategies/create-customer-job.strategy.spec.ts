import { Test, TestingModule } from '@nestjs/testing';
import { CreateCustomerJobStrategy } from './create-customer-job.strategy';
import { PaymentsService } from '../payments.service';
import { CacheService } from '@/shared/modules/cache/cache.service';
import { OrderRepository } from '@/modules/orders/repositories/order.repository';
import { UserRepository } from '@/modules/users/repositories/user.repository';
import { DataSource } from 'typeorm';
import Redlock from 'redlock';

describe('CreateCustomerJobStrategy', () => {
  let strategy: CreateCustomerJobStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateCustomerJobStrategy,
        {
          provide: PaymentsService,
          useValue: { customersCreate: jest.fn() },
        },
        {
          provide: CacheService,
          useValue: { get: jest.fn(), set: jest.fn() },
        },
        {
          provide: OrderRepository,
          useValue: { findOne: jest.fn() },
        },
        {
          provide: UserRepository,
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
