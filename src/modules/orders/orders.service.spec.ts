import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { OrdersService } from './orders.service';
import { OrderStatus } from './enums/order-status.enum';
import { CacheService } from '../cache/cache.service';
import { EVENT_BUS } from '../events/constants/event-bus.token';
import { OrderRepository } from './repositories/order.repository';
import { OrderItemRepository } from './repositories/order-item.repository';

describe('OrderService', () => {
  let service: OrdersService;
  let orderRepository: any;
  let orderItemRepository: any;
  let cacheService: any;
  let orderQueue: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: OrderRepository,
          useValue: {
            createEntity: jest.fn(),
            save: jest.fn(),
            findOneWithRelations: jest.fn(),
            findAllWithFilters: jest.fn(),
          },
        },
        {
          provide: OrderItemRepository,
          useValue: {
            createEntity: jest.fn(),
            saveMany: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getQueueToken('orders'),
          useValue: {
            add: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            delete: jest.fn(),
            deletePattern: jest.fn(),
          },
        },
        {
          provide: EVENT_BUS,
          useValue: { publish: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    orderRepository = module.get(OrderRepository);
    orderItemRepository = module.get(OrderItemRepository);
    cacheService = module.get<CacheService>(CacheService);
    orderQueue = module.get(getQueueToken('orders'));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createOrderDto = {
      items: [
        {
          productId: 'product-456',
          quantity: 2,
          price: 99.99,
        },
      ],
    };
    const userId = 'customer-123';
    const idempotencyKey = 'unique-key-123';

    const mockOrder = {
      id: 'order-uuid',
      userId: 'customer-123',
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

    it('should create an order successfully when no idempotency key exists in cache', async () => {
      // Mock cache get to return null (no existing order)
      cacheService.get.mockResolvedValue(null);
      orderRepository.createEntity.mockReturnValue({
        ...mockOrder,
        user: { id: '' },
      });
      orderRepository.save.mockResolvedValue(mockOrder);
      orderItemRepository.createEntity.mockImplementation((data) => data);
      orderItemRepository.saveMany.mockResolvedValue([]);
      orderRepository.findOneWithRelations.mockResolvedValue(mockOrder);
      cacheService.set.mockResolvedValue(undefined);
      cacheService.delete.mockResolvedValue(undefined);

      const result = await service.create(
        createOrderDto,
        userId,
        idempotencyKey,
      );

      expect(result).toEqual(mockOrder);
      expect(cacheService.get).toHaveBeenCalledWith(
        `idempotency:${idempotencyKey}`,
      );
      expect(cacheService.set).toHaveBeenCalledWith(
        `idempotency:${idempotencyKey}`,
        mockOrder,
        86400000, // IDEMPOTENCY_TTL in milliseconds
      );
      expect(orderRepository.createEntity).toHaveBeenCalled();
      expect(orderRepository.save).toHaveBeenCalled();
      expect(orderItemRepository.saveMany).toHaveBeenCalled();
      // Queue job name is the OrderJob enum value, not a kebab-case string
      expect(orderQueue.add).toHaveBeenCalledWith('PROCESS_ORDER', {
        orderId: mockOrder.id,
        userId: mockOrder.userId,
        total: mockOrder.total,
      });
    });

    it('should return existing order when idempotency key exists in cache', async () => {
      const existingOrder = {
        id: 'existing-order-uuid',
        userId: 'customer-123',
        total: 199.98,
        status: OrderStatus.PENDING,
        items: [],
      };

      // Mock cache get to return existing order
      cacheService.get.mockResolvedValue(existingOrder);

      const result = await service.create(
        createOrderDto,
        userId,
        idempotencyKey,
      );

      expect(result).toEqual(existingOrder);
      expect(cacheService.get).toHaveBeenCalledWith(
        `idempotency:${idempotencyKey}`,
      );
      expect(orderRepository.createEntity).not.toHaveBeenCalled();
      expect(orderRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return an order from cache if available', async () => {
      const orderId = 'order-uuid';
      const mockOrder = {
        id: orderId,
        userId: 'customer-123',
        status: OrderStatus.PENDING,
        total: 199.98,
      };

      cacheService.get.mockResolvedValue(mockOrder);

      const result = await service.findOne(orderId);

      expect(result).toEqual(mockOrder);
      expect(cacheService.get).toHaveBeenCalledWith(`order:${orderId}`);
      expect(orderRepository.findOneWithRelations).not.toHaveBeenCalled();
    });

    it('should fetch order from database and cache it if not in cache', async () => {
      const orderId = 'order-uuid';
      const mockOrder = {
        id: orderId,
        userId: 'customer-123',
        status: OrderStatus.PENDING,
        total: 199.98,
      };

      cacheService.get.mockResolvedValue(null);
      orderRepository.findOneWithRelations.mockResolvedValue(mockOrder);
      cacheService.set.mockResolvedValue(undefined);

      const result = await service.findOne(orderId);

      expect(result).toEqual(mockOrder);
      expect(orderRepository.findOneWithRelations).toHaveBeenCalledWith(
        { id: orderId },
        ['user', 'items'],
      );
      expect(cacheService.set).toHaveBeenCalledWith(
        `order:${orderId}`,
        mockOrder,
        300000,
      );
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
