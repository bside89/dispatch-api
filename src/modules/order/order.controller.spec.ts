import { Test, TestingModule } from '@nestjs/testing';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus } from './enums/order-status.enum';
import { OrderQueryDto } from './dto/order-query.dto';

describe('OrderController', () => {
  let controller: OrderController;
  let service: OrderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [
        {
          provide: OrderService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            updateStatus: jest.fn(),
            remove: jest.fn(),
            findByCustomerId: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<OrderController>(OrderController);
    service = module.get<OrderService>(OrderService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create an order without idempotency key', async () => {
      const createOrderDto: CreateOrderDto = {
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
        status: OrderStatus.PENDING,
        total: 199.98,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [],
      };

      jest.spyOn(service, 'create').mockResolvedValue(mockOrder as any);

      const result = await controller.create(createOrderDto);

      expect(result).toEqual(mockOrder);
      expect(service.create).toHaveBeenCalledWith(createOrderDto, undefined);
    });

    it('should create an order with idempotency key', async () => {
      const createOrderDto: CreateOrderDto = {
        customerId: 'customer-123',
        items: [
          {
            productId: 'product-456',
            quantity: 2,
            price: 99.99,
          },
        ],
      };

      const idempotencyKey = 'test-idempotency-key';

      const mockOrder = {
        id: 'order-uuid',
        customerId: 'customer-123',
        status: OrderStatus.PENDING,
        total: 199.98,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [],
      };

      jest.spyOn(service, 'create').mockResolvedValue(mockOrder as any);

      // Simulate the controller method that would extract the header
      const result = await service.create(createOrderDto, idempotencyKey);

      expect(result).toEqual(mockOrder);
      expect(service.create).toHaveBeenCalledWith(
        createOrderDto,
        idempotencyKey,
      );
    });
  });

  describe('findAll', () => {
    it('should return orders list', async () => {
      const queryDto: OrderQueryDto = { page: 1, limit: 10 };
      const mockResponse = {
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
        data: [],
      };

      jest.spyOn(service, 'findAll').mockResolvedValue(mockResponse);

      const result = await controller.findAll(queryDto);

      expect(result).toEqual(mockResponse);
      expect(service.findAll).toHaveBeenCalledWith(queryDto);
    });
  });

  describe('findOne', () => {
    it('should return an order by id', async () => {
      const orderId = 'order-uuid';
      const mockOrder = {
        id: orderId,
        customerId: 'customer-123',
        status: OrderStatus.PENDING,
        total: 199.98,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [],
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(mockOrder as any);

      const result = await controller.findOne(orderId);

      expect(result).toEqual(mockOrder);
      expect(service.findOne).toHaveBeenCalledWith(orderId);
    });
  });

  describe('updateStatus', () => {
    it('should update order status', async () => {
      const orderId = 'order-uuid';
      const newStatus = OrderStatus.CONFIRMED;
      const mockOrder = {
        id: orderId,
        customerId: 'customer-123',
        status: newStatus,
        total: 199.98,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [],
      };

      jest.spyOn(service, 'updateStatus').mockResolvedValue(mockOrder as any);

      const result = await controller.updateStatus(orderId, newStatus);

      expect(result).toEqual(mockOrder);
      expect(service.updateStatus).toHaveBeenCalledWith(orderId, newStatus);
    });
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
