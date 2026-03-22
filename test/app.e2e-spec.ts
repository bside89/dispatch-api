import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { OrderStatus } from '../src/modules/order/enums/order-status.enum';

describe('OrderController (e2e)', () => {
  let app: INestApplication;
  let orderId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/orders (POST)', () => {
    it('should create a new order', () => {
      const createOrderDto = {
        customerId: 'customer-e2e-test',
        items: [
          {
            productId: 'product-e2e-1',
            quantity: 2,
            price: 99.99,
          },
          {
            productId: 'product-e2e-2',
            quantity: 1,
            price: 149.99,
          },
        ],
      };

      return request(app.getHttpServer())
        .post('/orders')
        .send(createOrderDto)
        .expect(201)
        .then((response) => {
          expect(response.body).toHaveProperty('id');
          expect(response.body.customerId).toBe(createOrderDto.customerId);
          expect(response.body.status).toBe(OrderStatus.PENDING);
          expect(response.body.total).toBe('349.97');
          expect(response.body.items).toHaveLength(2);
          orderId = response.body.id;
        });
    });

    it('should return validation error for invalid order', () => {
      const invalidOrderDto = {
        customerId: '',
        items: [],
      };

      return request(app.getHttpServer())
        .post('/orders')
        .send(invalidOrderDto)
        .expect(400);
    });
  });

  describe('/orders (GET)', () => {
    it('should return orders list', () => {
      return request(app.getHttpServer())
        .get('/orders')
        .expect(200)
        .then((response) => {
          expect(response.body).toHaveProperty('total');
          expect(response.body).toHaveProperty('page');
          expect(response.body).toHaveProperty('limit');
          expect(response.body).toHaveProperty('totalPages');
          expect(response.body).toHaveProperty('data');
          expect(Array.isArray(response.body.data)).toBe(true);
        });
    });

    it('should filter orders by customer', () => {
      return request(app.getHttpServer())
        .get('/orders?customerId=customer-e2e-test')
        .expect(200)
        .then((response) => {
          response.body.data.forEach((order: any) => {
            expect(order.customerId).toBe('customer-e2e-test');
          });
        });
    });
  });

  describe('/orders/:id (GET)', () => {
    it('should return an order by id', () => {
      return request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .expect(200)
        .then((response) => {
          expect(response.body.id).toBe(orderId);
          expect(response.body).toHaveProperty('customerId');
          expect(response.body).toHaveProperty('status');
          expect(response.body).toHaveProperty('total');
          expect(response.body).toHaveProperty('items');
        });
    });

    it('should return 404 for non-existent order', () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      return request(app.getHttpServer())
        .get(`/orders/${fakeId}`)
        .expect(404);
    });
  });

  describe('/orders/:id/status (PATCH)', () => {
    it('should update order status', () => {
      return request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .send({ status: OrderStatus.CONFIRMED })
        .expect(200)
        .then((response) => {
          expect(response.body.status).toBe(OrderStatus.CONFIRMED);
        });
    });
  });

  describe('/orders/customer/:customerId (GET)', () => {
    it('should return orders for specific customer', () => {
      return request(app.getHttpServer())
        .get('/orders/customer/customer-e2e-test')
        .expect(200)
        .then((response) => {
          expect(Array.isArray(response.body)).toBe(true);
          if (response.body.length > 0) {
            response.body.forEach((order: any) => {
              expect(order.customerId).toBe('customer-e2e-test');
            });
          }
        });
    });
  });
});