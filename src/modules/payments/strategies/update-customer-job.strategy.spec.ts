import { Test, TestingModule } from '@nestjs/testing';
import { UpdateCustomerJobStrategy } from './update-customer-job.strategy';
import { CacheService } from '@/shared/modules/cache/cache.service';
import { OrderRepository } from '@/modules/orders/repositories/order.repository';
import { UserRepository } from '@/modules/users/repositories/user.repository';
import { DataSource } from 'typeorm';
import Redlock from 'redlock';
import { PaymentsGatewayService } from '@/modules/payments-gateway/payments-gateway.service';

describe('UpdateCustomerJobStrategy', () => {
  let strategy: UpdateCustomerJobStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateCustomerJobStrategy,
        {
          provide: PaymentsGatewayService,
          useValue: { customersUpdate: jest.fn() },
        },
        { provide: CacheService, useValue: {} },
        { provide: OrderRepository, useValue: {} },
        { provide: UserRepository, useValue: {} },
        { provide: DataSource, useValue: {} },
        { provide: Redlock, useValue: {} },
      ],
    }).compile();

    strategy = module.get<UpdateCustomerJobStrategy>(UpdateCustomerJobStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });
});
