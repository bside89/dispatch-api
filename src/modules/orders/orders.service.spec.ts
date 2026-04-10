import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { OrderRepository } from './repositories/order.repository';
import { OrderItemRepository } from './repositories/order-item.repository';
import { CacheService } from '../../shared/modules/cache/cache.service';
import { OutboxService } from '../../shared/modules/outbox/outbox.service';
import { DataSource } from 'typeorm';
import Redlock from 'redlock';
import { UserRole } from '../users/enums/user-role.enum';

describe('OrdersService', () => {
  let service: OrdersService;
  let orderRepository: { filter: jest.Mock; findOne: jest.Mock };
  let cacheService: { get: jest.Mock; set: jest.Mock; deleteBulk: jest.Mock };

  beforeEach(async () => {
    orderRepository = {
      filter: jest.fn(),
      findOne: jest.fn(),
    };

    cacheService = {
      get: jest.fn(),
      set: jest.fn(),
      deleteBulk: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: OrderRepository,
          useValue: orderRepository,
        },
        {
          provide: OrderItemRepository,
          useValue: {
            createEntity: jest.fn(),
            saveBulk: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: cacheService,
        },
        {
          provide: OutboxService,
          useValue: {
            add: jest.fn(),
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

    service = module.get<OrdersService>(OrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('scopes order listing to the authenticated user when not admin', async () => {
    const requestUser = {
      id: 'user-1',
      jwtPayload: {
        sub: 'user-1',
        email: 'user@example.com',
        role: UserRole.USER,
        jti: 'token-id',
      },
    };

    cacheService.get.mockResolvedValue(null);
    orderRepository.filter.mockResolvedValue({
      total: 0,
      page: 1,
      limit: 20,
      data: [] as never[],
      totalPages: 0,
    });

    await service.findAll({ page: 1, limit: 20 } as never, requestUser as never);

    expect(orderRepository.filter).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' }),
    );
  });

  it('rejects access to an order owned by another user', async () => {
    const requestUser = {
      id: 'user-1',
      jwtPayload: {
        sub: 'user-1',
        email: 'user@example.com',
        role: UserRole.USER,
        jti: 'token-id',
      },
    };

    cacheService.get.mockResolvedValue(null);
    orderRepository.findOne.mockResolvedValue({
      id: 'order-1',
      userId: 'user-2',
      user: { id: 'user-2' },
      items: [],
    });

    await expect(service.findOne('order-1', requestUser as never)).rejects.toThrow(
      'You are not allowed to access order with ID order-1',
    );
  });
});
