import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { OrderRepository } from './repositories/order.repository';
import { OrderItemRepository } from './repositories/order-item.repository';
import { ItemsService } from '../items/items.service';
import { CacheService } from '../../shared/modules/cache/cache.service';
import { OutboxService } from '../../shared/modules/outbox/outbox.service';
import { DataSource } from 'typeorm';
import Redlock from 'redlock';
import { PaymentsGatewayService } from '../payments-gateway/payments-gateway.service';
import { OrderStatus } from './enums/order-status.enum';
import {
  createCacheServiceMock,
  createDataSourceMock,
  createOutboxServiceMock,
  createRedlockMock,
} from '@/shared/testing/provider-mocks';

describe('OrdersService', () => {
  let service: OrdersService;
  let orderRepository: {
    createEntity: jest.Mock;
    save: jest.Mock;
    filter: jest.Mock;
    findOne: jest.Mock;
  };
  let orderItemRepository: {
    createEntity: jest.Mock;
    saveBulk: jest.Mock;
    delete: jest.Mock;
  };
  let cacheService: { get: jest.Mock; set: jest.Mock; deleteBulk: jest.Mock };
  let paymentsGatewayService: { paymentIntentsCreate: jest.Mock };
  let itemsService: {
    findManyByIds: jest.Mock;
    decrementItemStock: jest.Mock;
  };

  beforeEach(async () => {
    orderRepository = {
      createEntity: jest.fn(),
      save: jest.fn(),
      filter: jest.fn(),
      findOne: jest.fn(),
    };

    orderItemRepository = {
      createEntity: jest.fn(),
      saveBulk: jest.fn(),
      delete: jest.fn(),
    };

    cacheService = createCacheServiceMock();

    paymentsGatewayService = {
      paymentIntentsCreate: jest.fn(),
    };

    itemsService = {
      findManyByIds: jest.fn(),
      decrementItemStock: jest.fn(),
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
          useValue: orderItemRepository,
        },
        {
          provide: CacheService,
          useValue: cacheService,
        },
        {
          provide: OutboxService,
          useValue: createOutboxServiceMock(),
        },
        {
          provide: PaymentsGatewayService,
          useValue: paymentsGatewayService,
        },
        {
          provide: ItemsService,
          useValue: itemsService,
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

    service = module.get<OrdersService>(OrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create an order and initialize a stripe payment intent', async () => {
    cacheService.get.mockResolvedValue(null);
    cacheService.set.mockResolvedValue(undefined);
    cacheService.deleteBulk.mockResolvedValue(undefined);

    const catalogItems = [{ id: 'item-1', price: 2500, stock: 10 }];

    const orderEntity = {
      id: 'order-1',
      userId: 'user-1',
      total: 5000,
      status: OrderStatus.PENDING,
    };

    const completeOrder = {
      ...orderEntity,
      user: {
        customerId: 'cus_123',
        email: 'user@example.com',
        name: 'Test User',
      },
      items: [],
    };

    orderRepository.createEntity.mockReturnValue(orderEntity);
    orderRepository.save.mockResolvedValue(orderEntity);
    orderRepository.findOne.mockResolvedValue(completeOrder);
    orderItemRepository.createEntity.mockImplementation((value) => value);
    orderItemRepository.saveBulk.mockResolvedValue(undefined);
    paymentsGatewayService.paymentIntentsCreate.mockResolvedValue({
      id: 'pi_123',
      status: 'requires_confirmation',
      clientSecret: 'pi_123_secret_456',
    });

    itemsService.findManyByIds.mockResolvedValue(catalogItems);
    itemsService.decrementItemStock.mockResolvedValue(undefined);

    const result = await service.create(
      {
        items: [{ itemId: 'item-1', quantity: 2 }],
      },
      'user-1',
      'idem-123',
    );

    expect(paymentsGatewayService.paymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 5000,
        currency: 'brl',
        customer: 'cus_123',
        receipt_email: 'user@example.com',
        confirmation_method: 'automatic',
        automatic_payment_methods: { enabled: true },
        metadata: expect.objectContaining({
          orderId: 'order-1',
          userId: 'user-1',
        }),
      }),
      expect.stringContaining('idem-123'),
    );

    expect(itemsService.findManyByIds).toHaveBeenCalledWith(['item-1']);
    expect(itemsService.decrementItemStock).toHaveBeenCalledTimes(1);

    expect(result).toMatchObject({
      id: 'order-1',
      status: OrderStatus.PENDING,
      paymentIntent: {
        id: 'pi_123',
        status: 'requires_confirmation',
        clientSecret: 'pi_123_secret_456',
      },
    });
    expect(result.total).toBe(5000);
    expect(result.paymentIntent.clientSecret).toBe('pi_123_secret_456');
  });
});
