import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import {
  ORDERS_SERVICE,
  ORDER_REPOSITORY,
  ORDER_ITEM_REPOSITORY,
} from './constants/orders.token';
import { ITEMS_SERVICE } from '../items/constants/items.token';
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
        { provide: ORDERS_SERVICE, useClass: OrdersService },
        {
          provide: ORDER_REPOSITORY,
          useValue: orderRepository,
        },
        {
          provide: ORDER_ITEM_REPOSITORY,
          useValue: orderItemRepository,
        },
        {
          provide: CACHE_SERVICE,
          useValue: cacheService,
        },
        {
          provide: OrderMessageFactory,
          useValue: messages,
        },
        {
          provide: OUTBOX_SERVICE,
          useValue: createOutboxServiceMock(),
        },
        {
          provide: PAYMENTS_GATEWAY_SERVICE,
          useValue: paymentsGatewayService,
        },
        {
          provide: ITEMS_SERVICE,
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

    service = module.get<OrdersService>(ORDERS_SERVICE);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
