import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { UserRepository } from './repositories/user.repository';
import { CacheService } from '../../shared/modules/cache/cache.service';
import { OutboxService } from '../../shared/modules/outbox/outbox.service';
import { DataSource } from 'typeorm';
import Redlock from 'redlock';
import { UserRole } from './enums/user-role.enum';
import { PaymentsGatewayService } from '../payments-gateway/payments-gateway.service';
import {
  createCacheServiceMock,
  createDataSourceMock,
  createOutboxServiceMock,
  createRedlockMock,
} from '@/shared/testing/provider-mocks';
import { ForbiddenException } from '@nestjs/common';

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

  it('scopes the user list to the authenticated user when not admin', async () => {
    const requestUser = {
      id: 'user-1',
      jwtPayload: {
        sub: 'user-1',
        email: 'user@example.com',
        role: UserRole.USER,
        jti: 'token-id',
      },
    };

    userRepository.findById.mockResolvedValue({
      id: 'user-1',
      name: 'Jane Doe',
      email: 'jane@example.com',
    });

    const result = await service.findAll(
      { page: 1, limit: 10, name: 'Jane' } as never,
      requestUser as never,
    );

    expect(result.total).toBe(1);
    expect(result.data).toHaveLength(1);
    expect(userRepository.filter).not.toHaveBeenCalled();
  });

  it('rejects access to another user record', async () => {
    const requestUser = {
      id: 'user-1',
      jwtPayload: {
        sub: 'user-1',
        email: 'user@example.com',
        role: UserRole.USER,
        jti: 'token-id',
      },
    };

    await expect(service.findOne('user-2', requestUser as never)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
