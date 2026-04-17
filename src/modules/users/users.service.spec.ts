import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { UserRepository } from './repositories/user.repository';
import { CacheService } from '../../shared/modules/cache/cache.service';
import { OutboxService } from '../../shared/modules/outbox/outbox.service';
import { DataSource } from 'typeorm';
import Redlock from 'redlock';
import { PaymentsGatewayService } from '../payments-gateway/payments-gateway.service';
import {
  createCacheServiceMock,
  createDataSourceMock,
  createOutboxServiceMock,
  createRedlockMock,
} from '@/shared/testing/provider-mocks';

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: {
    findById: jest.Mock;
    findOne: jest.Mock;
    createEntity: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
    filter: jest.Mock;
    existsBy: jest.Mock;
    deleteById: jest.Mock;
  };
  let cacheService: { get: jest.Mock; set: jest.Mock; deleteBulk: jest.Mock };
  let outboxService: { add: jest.Mock };
  let paymentsGatewayService: { createCustomer: jest.Mock };

  beforeEach(async () => {
    userRepository = {
      findById: jest.fn(),
      findOne: jest.fn(),
      createEntity: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      filter: jest.fn(),
      existsBy: jest.fn(),
      deleteById: jest.fn(),
    };

    cacheService = createCacheServiceMock();

    outboxService = createOutboxServiceMock();

    paymentsGatewayService = {
      createCustomer: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UserRepository,
          useValue: userRepository,
        },
        {
          provide: PaymentsGatewayService,
          useValue: paymentsGatewayService,
        },
        {
          provide: CacheService,
          useValue: cacheService,
        },
        {
          provide: OutboxService,
          useValue: outboxService,
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

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
