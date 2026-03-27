import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus } from './enums/order-status.enum';
import { OrderQueryDto } from './dto/order-query.dto';

describe('OrderController', () => {
  let controller: OrdersController;
  let service: OrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        {
          provide: OrdersService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            updateStatus: jest.fn(),
            remove: jest.fn(),
            findByUserId: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
    service = module.get<OrdersService>(OrdersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createOrderDto: CreateOrderDto = {
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
      userId: 'customer-123',
      status: OrderStatus.PENDING,
      total: 199.98,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [],
    };

    it('should create an order with idempotency key', async () => {
      const req = { user: { id: 'customer-123' } };
      jest.spyOn(service, 'create').mockResolvedValue(mockOrder as any);

      const result = await controller.create(
        createOrderDto,
        idempotencyKey,
        req,
      );

      expect(result).toEqual(mockOrder);
      expect(service.create).toHaveBeenCalledWith(
        createOrderDto,
        req.user.id,
        idempotencyKey,
      );
    });

    it('should throw BadRequestException when idempotency key is not provided', async () => {
      const req = { user: { id: 'customer-123' } };

      await expect(
        controller.create(createOrderDto, undefined, req),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.create(createOrderDto, undefined, req),
      ).rejects.toThrow('Idempotency-Key header is required');

      expect(service.create).not.toHaveBeenCalled();
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
        userId: 'customer-123',
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
        userId: 'customer-123',
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
