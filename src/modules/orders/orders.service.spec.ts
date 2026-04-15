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
import {
  createCacheServiceMock,
  createDataSourceMock,
  createOutboxServiceMock,
  createRedlockMock,
} from '@/shared/testing/provider-mocks';
import { OrderMessageFactory } from './factories/order-message.factory';

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
  let messages: jest.Mocked<OrderMessageFactory>;
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
          provide: OrderMessageFactory,
          useValue: messages,
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
});
