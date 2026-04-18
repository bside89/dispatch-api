import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { USERS_SERVICE, USER_REPOSITORY } from './constants/users.token';
import { CACHE_SERVICE } from '../../shared/modules/cache/constants/cache.token';
import { OUTBOX_SERVICE } from '../../shared/modules/outbox/constants/outbox.token';
import { PAYMENTS_GATEWAY_SERVICE } from '../payments-gateway/constants/payments-gateway.token';
import { DataSource } from 'typeorm';
import Redlock from 'redlock';
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
        { provide: USERS_SERVICE, useClass: UsersService },
        {
          provide: USER_REPOSITORY,
          useValue: userRepository,
        },
        {
          provide: PAYMENTS_GATEWAY_SERVICE,
          useValue: paymentsGatewayService,
        },
        {
          provide: CACHE_SERVICE,
          useValue: cacheService,
        },
        {
          provide: OUTBOX_SERVICE,
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

    service = module.get<UsersService>(USERS_SERVICE);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
