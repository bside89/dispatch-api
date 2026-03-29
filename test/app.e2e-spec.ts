import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { OrderStatus } from '../src/modules/orders/enums/order-status.enum';

describe('OrderController (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let userId: string;
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

    // Create test user (public endpoint)
    const testEmail = `e2e-${Date.now()}@example.com`;
    await request(app.getHttpServer())
      .post('/v1/users')
      .set('idempotency-key', `idem-e2e-user-${Date.now()}`)
      .send({ name: 'E2E Test User', email: testEmail, password: 'Password1!' })
      .expect(201);

    // Login and capture JWT
    const loginRes = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: testEmail, password: 'Password1!' })
      .expect(201);

    accessToken = loginRes.body.accessToken;

    // Extract userId from JWT payload (sub claim)
    const [, payloadB64] = accessToken.split('.');
    userId = JSON.parse(Buffer.from(payloadB64, 'base64').toString()).sub;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/v1/orders (POST)', () => {
    it('should create a new order', () => {
      const createOrderDto = {
        items: [
          {
            productId: 'product-e2e-1',
            quantity: 2,
            price: 9999,
          },
          {
            productId: 'product-e2e-2',
            quantity: 1,
            price: 14999,
          },
        ],
      };

      return request(app.getHttpServer())
        .post('/v1/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('idempotency-key', `idem-order-e2e-${Date.now()}`)
        .send(createOrderDto)
        .expect(201)
        .then((response) => {
          expect(response.body.data).toHaveProperty('id');
          expect(response.body.data.status).toBe(OrderStatus.PENDING);
          expect(response.body.data.items).toHaveLength(2);
          orderId = response.body.data.id;
        });
    });

    it('should return validation error for invalid order', () => {
      return request(app.getHttpServer())
        .post('/v1/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ items: [] })
        .expect(400);
    });
  });

  describe('/v1/orders (GET)', () => {
    it('should return orders list', () => {
      return request(app.getHttpServer())
        .get('/v1/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .then((response) => {
          expect(response.body).toHaveProperty('data');
          expect(response.body.meta).toHaveProperty('total');
          expect(response.body.meta).toHaveProperty('page');
          expect(response.body.meta).toHaveProperty('limit');
          expect(response.body.meta).toHaveProperty('totalPages');
          expect(Array.isArray(response.body.data)).toBe(true);
        });
    });

    it('should filter orders by user', () => {
      return request(app.getHttpServer())
        .get(`/v1/orders?userId=${userId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .then((response) => {
          expect(response.body).toHaveProperty('data');
          expect(Array.isArray(response.body.data)).toBe(true);
          // The order created earlier should appear when filtering by the logged-in user
          expect(response.body.data.length).toBeGreaterThan(0);
        });
    });
  });

  describe('/v1/orders/:id (GET)', () => {
    it('should return an order by id', () => {
      return request(app.getHttpServer())
        .get(`/v1/orders/${orderId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .then((response) => {
          expect(response.body.data.id).toBe(orderId);
          expect(response.body.data).toHaveProperty('status');
          expect(response.body.data).toHaveProperty('total');
          expect(response.body.data).toHaveProperty('items');
        });
    });

    it('should return 404 for non-existent order', () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      return request(app.getHttpServer())
        .get(`/v1/orders/${fakeId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('/v1/orders/:id/status (PATCH)', () => {
    it('should update order status', () => {
      return request(app.getHttpServer())
        .patch(`/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ status: OrderStatus.CONFIRMED })
        .expect(200)
        .then((response) => {
          expect(response.body.data.status).toBe(OrderStatus.CONFIRMED);
        });
    });
  });

  describe('/v1/orders?userId (GET) — filtered', () => {
    it('should return paginated orders filtered by userId', () => {
      return request(app.getHttpServer())
        .get(`/v1/orders?userId=${userId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .then((response) => {
          expect(response.body).toHaveProperty('data');
          expect(Array.isArray(response.body.data)).toBe(true);
          expect(response.body.meta).toHaveProperty('total');
          expect(response.body.meta).toHaveProperty('page');
        });
    });
  });
});
