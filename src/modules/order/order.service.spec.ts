import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { getQueueToken } from '@nestjs/bullmq';
import { OrderService } from './order.service';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderStatus } from './enums/order-status.enum';
import { JobQueue } from '../common/enums/job-queue.enum';

describe('OrderService', () => {
  let service: OrderService;
  let orderRepository: any;
  let orderItemRepository: any;
  let cacheManager: any;
  let orderQueue: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: getRepositoryToken(Order),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            remove: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(OrderItem),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
        {
          provide: getQueueToken(JobQueue.ORDER_PROCESSING),
          useValue: {
            add: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    orderRepository = module.get(getRepositoryToken(Order));
    orderItemRepository = module.get(getRepositoryToken(OrderItem));
    cacheManager = module.get(CACHE_MANAGER);
    orderQueue = module.get(getQueueToken(JobQueue.ORDER_PROCESSING));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create an order successfully without idempotency key', async () => {
      const createOrderDto = {
        customerId: 'customer-123',
        items: [
          {
            productId: 'product-456',
            quantity: 2,
            price: 99.99,
          },
        ],
      };

      const mockOrder = {
        id: 'order-uuid',
        customerId: 'customer-123',
        total: 199.98,
        status: OrderStatus.PENDING,
        items: [
          {
            id: 'item-uuid',
            productId: 'product-456',
            quantity: 2,
            price: 99.99,
            orderId: 'order-uuid',
          },
        ],
      };

      orderRepository.create.mockReturnValue(mockOrder);
      orderRepository.save.mockResolvedValue(mockOrder);
      orderItemRepository.create.mockImplementation((data) => data);
      orderItemRepository.save.mockResolvedValue([]);
      orderRepository.findOne.mockResolvedValue(mockOrder);

      const result = await service.create(createOrderDto);

      expect(result).toEqual(mockOrder);
      expect(orderRepository.create).toHaveBeenCalled();
      expect(orderRepository.save).toHaveBeenCalled();
      expect(orderItemRepository.save).toHaveBeenCalled();
      expect(orderQueue.add).toHaveBeenCalledWith('process-order', {
        orderId: mockOrder.id,
        customerId: mockOrder.customerId,
        total: mockOrder.total,
      });
    });

    it('should create an order with idempotency key', async () => {
      const createOrderDto = {
        customerId: 'customer-123',
        items: [
          {
            productId: 'product-456',
            quantity: 2,
            price: 99.99,
          },
        ],
      };

      const idempotencyKey = 'unique-key-123';

      const mockOrder = {
        id: 'order-uuid',
        customerId: 'customer-123',
        total: 199.98,
        status: OrderStatus.PENDING,
        items: [
          {
            id: 'item-uuid',
            productId: 'product-456',
            quantity: 2,
            price: 99.99,
            orderId: 'order-uuid',
          },
        ],
      };

      // Mock cache get to return null (no existing order)
      cacheManager.get.mockResolvedValue(null);
      orderRepository.create.mockReturnValue(mockOrder);
      orderRepository.save.mockResolvedValue(mockOrder);
      orderItemRepository.create.mockImplementation((data) => data);
      orderItemRepository.save.mockResolvedValue([]);
      orderRepository.findOne.mockResolvedValue(mockOrder);

      const result = await service.create(createOrderDto, idempotencyKey);

      expect(result).toEqual(mockOrder);
      expect(cacheManager.get).toHaveBeenCalledWith(
        `idempotency:${idempotencyKey}`,
      );
      expect(cacheManager.set).toHaveBeenCalledWith(
        `idempotency:${idempotencyKey}`,
        mockOrder,
        86400, // IDEMPOTENCY_TTL
      );
      expect(orderRepository.create).toHaveBeenCalled();
      expect(orderRepository.save).toHaveBeenCalled();
      expect(orderItemRepository.save).toHaveBeenCalled();
    });

    it('should return existing order when idempotency key exists', async () => {
      const createOrderDto = {
        customerId: 'customer-123',
        items: [
          {
            productId: 'product-456',
            quantity: 2,
            price: 99.99,
          },
        ],
      };

      const idempotencyKey = 'existing-key-123';

      const existingOrder = {
        id: 'existing-order-uuid',
        customerId: 'customer-123',
        total: 199.98,
        status: OrderStatus.PENDING,
        items: [],
      };

      // Mock cache get to return existing order
      cacheManager.get.mockResolvedValue(existingOrder);

      const result = await service.create(createOrderDto, idempotencyKey);

      expect(result).toEqual(existingOrder);
      expect(cacheManager.get).toHaveBeenCalledWith(
        `idempotency:${idempotencyKey}`,
      );
      expect(orderRepository.create).not.toHaveBeenCalled();
      expect(orderRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return an order from cache if available', async () => {
      const orderId = 'order-uuid';
      const mockOrder = {
        id: orderId,
        customerId: 'customer-123',
        status: OrderStatus.PENDING,
        total: 199.98,
      };

      cacheManager.get.mockResolvedValue(mockOrder);

      const result = await service.findOne(orderId);

      expect(result).toEqual(mockOrder);
      expect(cacheManager.get).toHaveBeenCalledWith(`order:${orderId}`);
      expect(orderRepository.findOne).not.toHaveBeenCalled();
    });

    it('should fetch order from database and cache it if not in cache', async () => {
      const orderId = 'order-uuid';
      const mockOrder = {
        id: orderId,
        customerId: 'customer-123',
        status: OrderStatus.PENDING,
        total: 199.98,
      };

      cacheManager.get.mockResolvedValue(null);
      orderRepository.findOne.mockResolvedValue(mockOrder);

      const result = await service.findOne(orderId);

      expect(result).toEqual(mockOrder);
      expect(orderRepository.findOne).toHaveBeenCalledWith({
        where: { id: orderId },
        relations: ['items'],
      });
      expect(cacheManager.set).toHaveBeenCalledWith(
        `order:${orderId}`,
        mockOrder,
        300,
      );
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
