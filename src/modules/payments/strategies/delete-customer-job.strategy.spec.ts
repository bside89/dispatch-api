import { Test, TestingModule } from '@nestjs/testing';
import { DeleteCustomerJobStrategy } from './delete-customer-job.strategy';
import { CacheService } from '@/shared/modules/cache/cache.service';
import { OrderRepository } from '@/modules/orders/repositories/order.repository';
import { UserRepository } from '@/modules/users/repositories/user.repository';
import { DataSource } from 'typeorm';
import Redlock from 'redlock';
import { PaymentsGatewayService } from '@/modules/payments-gateway/payments-gateway.service';

describe('DeleteCustomerJobStrategy', () => {
  let strategy: DeleteCustomerJobStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteCustomerJobStrategy,
        {
          provide: PaymentsGatewayService,
          useValue: { customersDelete: jest.fn() },
        },
        {
          provide: CacheService,
          useValue: {},
        },
        {
          provide: OrderRepository,
          useValue: {},
        },
        {
          provide: UserRepository,
          useValue: { findById: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: {},
        },
        {
          provide: Redlock,
          useValue: {},
        },
      ],
    }).compile();

    strategy = module.get<DeleteCustomerJobStrategy>(DeleteCustomerJobStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });
});
