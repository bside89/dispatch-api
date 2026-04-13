import { AppModule } from '@/app.module';
import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { ADMIN_USER } from './constants/admin-user.constant';
import { cleanDatabase, cleanRedis } from './utils/database-cleaner';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@/shared/modules/cache/constants/redis-client.constant';
import { paymentsGatewayServiceMock } from './utils/mock-payments-gateway-service';
import { PaymentsGatewayService } from '@/modules/payments-gateway/payments-gateway.service';
import { OrderStatus } from '@/modules/orders/enums/order-status.enum';
import { JwtService } from '@nestjs/jwt';
import {
  createAccessToken,
  createFixtureItem,
  createFixtureUser,
  getAdminFixture,
} from './utils/e2e-fixtures';

describe('Orders (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let redisClient: Redis;
  let jwtService: JwtService;

  let adminToken: string;
  let userToken: string;
  let testItemId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PaymentsGatewayService)
      .useValue(paymentsGatewayServiceMock)
      .compile();

    app = module.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();

    dataSource = app.get<DataSource>(DataSource);
    redisClient = app.get<Redis>(REDIS_CLIENT);
    jwtService = app.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    await app.close();
  }, 30000);

  beforeEach(async () => {
    await cleanDatabase(dataSource);
    await cleanRedis(redisClient);

    const adminUser = getAdminFixture();
    adminToken = createAccessToken(jwtService, adminUser);

    const item = await createFixtureItem(dataSource);
    testItemId = item.id;

    const regularUser = await createFixtureUser(dataSource);
    userToken = createAccessToken(jwtService, regularUser);
  });

  describe('REST Endpoints', () => {
    it('POST /v1/orders - should return 401 if no jwt token is provided', async () => {
      const payload = {
        items: [
          {
            itemId: '550e8400-e29b-41d4-a716-446655440099',
            quantity: 3,
          },
        ],
      };

      return request(app.getHttpServer())
        .post('/v1/orders')
        .send(payload)
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('POST /v1/orders - should return 400 if payload is empty', async () => {
      return request(app.getHttpServer())
        .post('/v1/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('POST /v1/orders - should create order and return 201', async () => {
      const payload = {
        items: [
          {
            itemId: testItemId,
            quantity: 2,
          },
        ],
      };

      const res = await request(app.getHttpServer())
        .post('/v1/orders')
        .set('idempotency-key', 'e2e-test-key')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(HttpStatus.CREATED);

      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.paymentIntent.clientSecret).toBeDefined();
    });

    it('POST /v1/orders - should return the same order on duplicate idempotency key', async () => {
      const payload = {
        items: [
          {
            itemId: testItemId,
            quantity: 2,
          },
        ],
      };
      const key = 'duplicate-key-orders';

      const result1 = await request(app.getHttpServer())
        .post('/v1/orders')
        .set('idempotency-key', key)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(HttpStatus.CREATED);

      // Segunda tentativa com a mesma chave
      const result2 = await request(app.getHttpServer())
        .post('/v1/orders')
        .set('idempotency-key', key)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(HttpStatus.CREATED);

      expect(result2.body.data.id).toBe(result1.body.data.id);
      expect(result2.body.data.status).toBe(result1.body.data.status);
    });

    it('POST /v1/orders - should rollback the Order when Stripe returns an error', async () => {
      // Arrange: force paymentIntentsCreate to throw for this one call.
      // create() runs inside @Transactional(), so all DB writes (order +
      // order_items + stock decrement) must be rolled back.
      (
        paymentsGatewayServiceMock.paymentIntentsCreate as jest.Mock
      ).mockRejectedValueOnce(new Error('Simulated Stripe error'));

      const payload = {
        items: [{ itemId: testItemId, quantity: 1 }],
      };

      await request(app.getHttpServer())
        .post('/v1/orders')
        .set('idempotency-key', 'e2e-order-rollback-key')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(HttpStatus.INTERNAL_SERVER_ERROR);

      const orders = await dataSource.query(
        `SELECT id FROM orders WHERE "userId" = $1`,
        [ADMIN_USER.id],
      );
      expect(orders).toHaveLength(0);
    });

    it('GET /v1/orders - should return orders list (requires auth)', async () => {
      await request(app.getHttpServer())
        .get('/v1/orders')
        .expect(HttpStatus.UNAUTHORIZED);

      const res = await request(app.getHttpServer())
        .get('/v1/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);

      expect(res.body.data).toBeInstanceOf(Array);
    });

    it('GET /v1/orders/:id - should get own order', async () => {
      const payload = {
        items: [{ itemId: testItemId, quantity: 1 }],
      };
      const created = await request(app.getHttpServer())
        .post('/v1/orders')
        .set('idempotency-key', 'order-get-own-key')
        .set('Authorization', `Bearer ${userToken}`)
        .send(payload)
        .expect(HttpStatus.CREATED);

      const orderId = created.body.data.id;

      const res = await request(app.getHttpServer())
        .get(`/v1/orders/${orderId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(HttpStatus.OK);

      expect(res.body.data.id).toBe(orderId);
    });

    it('GET /v1/orders/:id - should block access to another user order', async () => {
      const payload = {
        items: [{ itemId: testItemId, quantity: 1 }],
      };
      const created = await request(app.getHttpServer())
        .post('/v1/orders')
        .set('idempotency-key', 'order-get-other-key')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(HttpStatus.CREATED);

      await request(app.getHttpServer())
        .get(`/v1/orders/${created.body.data.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('PATCH /v1/orders/:id - should block normal user (403 Forbidden)', async () => {
      // Temporarily set TEST_ENV to false so RolesGuard won't bypass the check
      const originalTestEnv = process.env.TEST_ENV;
      process.env.TEST_ENV = 'false';

      await request(app.getHttpServer())
        .patch('/v1/orders/123e4567-e89b-12d3-a456-426614174000')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: OrderStatus.REFUNDED })
        .expect(HttpStatus.FORBIDDEN);

      process.env.TEST_ENV = originalTestEnv;
    });

    it('PATCH /v1/orders/:id - should allow admin user', async () => {
      // Temporarily set TEST_ENV to false so RolesGuard won't bypass the check
      const originalTestEnv = process.env.TEST_ENV;
      process.env.TEST_ENV = 'false';

      const payload = {
        items: [{ itemId: testItemId, quantity: 2 }],
      };
      const created = await request(app.getHttpServer())
        .post('/v1/orders')
        .set('idempotency-key', 'order-update-key')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(HttpStatus.CREATED);
      const orderId = created.body.data.id;

      await request(app.getHttpServer())
        .patch(`/v1/orders/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.REFUNDED })
        .expect(HttpStatus.OK);

      process.env.TEST_ENV = originalTestEnv;
    });

    it('DELETE /v1/orders/:id - should block normal user (403 Forbidden)', async () => {
      const originalTestEnv = process.env.TEST_ENV;
      process.env.TEST_ENV = 'false';

      await request(app.getHttpServer())
        .delete('/v1/orders/123e4567-e89b-12d3-a456-426614174000')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(HttpStatus.FORBIDDEN);

      process.env.TEST_ENV = originalTestEnv;
    });

    it('DELETE /v1/orders/:id - should allow admin user', async () => {
      const originalTestEnv = process.env.TEST_ENV;
      process.env.TEST_ENV = 'false';

      const payload = { items: [{ itemId: testItemId, quantity: 1 }] };
      const created = await request(app.getHttpServer())
        .post('/v1/orders')
        .set('idempotency-key', 'order-delete-key')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(HttpStatus.CREATED);
      const orderId = created.body.data.id;

      await request(app.getHttpServer())
        .delete(`/v1/orders/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK); // Orders remove endpoint returns 200 OK, not 204.

      process.env.TEST_ENV = originalTestEnv;
    });

    it('PATCH /v1/orders/:id/ship - should block normal user (403 Forbidden)', async () => {
      const originalTestEnv = process.env.TEST_ENV;
      process.env.TEST_ENV = 'false';

      await request(app.getHttpServer())
        .patch('/v1/orders/123e4567-e89b-12d3-a456-426614174000/ship')
        .set('Authorization', `Bearer ${userToken}`)
        .send({})
        .expect(HttpStatus.FORBIDDEN);

      process.env.TEST_ENV = originalTestEnv;
    });

    it('PATCH /v1/orders/:id/ship - should ship order and return tracking info', async () => {
      const originalTestEnv = process.env.TEST_ENV;
      process.env.TEST_ENV = 'false';

      const payload = { items: [{ itemId: testItemId, quantity: 1 }] };
      const created = await request(app.getHttpServer())
        .post('/v1/orders')
        .set('idempotency-key', 'order-ship-key')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(HttpStatus.CREATED);
      const orderId = created.body.data.id;

      // Advance order to PROCESSED status directly in DB
      await dataSource.query(
        `UPDATE orders SET status = 'PROCESSED' WHERE id = $1`,
        [orderId],
      );

      const res = await request(app.getHttpServer())
        .patch(`/v1/orders/${orderId}/ship`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ trackingNumber: 'BR123456789', carrier: 'Correios' })
        .expect(HttpStatus.OK);

      expect(res.body.data.status).toBe('SHIPPED');
      expect(res.body.data.trackingNumber).toBe('BR123456789');
      expect(res.body.data.carrier).toBe('Correios');
      expect(res.body.data.shippedAt).toBeDefined();

      process.env.TEST_ENV = originalTestEnv;
    });

    it('PATCH /v1/orders/:id/ship - should return 400 if order is not PROCESSED', async () => {
      const originalTestEnv = process.env.TEST_ENV;
      process.env.TEST_ENV = 'false';

      const payload = { items: [{ itemId: testItemId, quantity: 1 }] };
      const created = await request(app.getHttpServer())
        .post('/v1/orders')
        .set('idempotency-key', 'order-ship-invalid-status-key')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(HttpStatus.CREATED);
      const orderId = created.body.data.id;

      // Order is still PENDING — should not be shippable
      await request(app.getHttpServer())
        .patch(`/v1/orders/${orderId}/ship`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(HttpStatus.BAD_REQUEST);

      process.env.TEST_ENV = originalTestEnv;
    });

    it('PATCH /v1/orders/:id/deliver - should deliver order', async () => {
      const originalTestEnv = process.env.TEST_ENV;
      process.env.TEST_ENV = 'false';

      const payload = { items: [{ itemId: testItemId, quantity: 1 }] };
      const created = await request(app.getHttpServer())
        .post('/v1/orders')
        .set('idempotency-key', 'order-deliver-key')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(HttpStatus.CREATED);
      const orderId = created.body.data.id;

      // Advance order to SHIPPED status directly in DB
      await dataSource.query(`UPDATE orders SET status = 'SHIPPED' WHERE id = $1`, [
        orderId,
      ]);

      const res = await request(app.getHttpServer())
        .patch(`/v1/orders/${orderId}/deliver`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);

      expect(res.body.data.status).toBe('DELIVERED');
      expect(res.body.data.deliveredAt).toBeDefined();

      process.env.TEST_ENV = originalTestEnv;
    });

    it('PATCH /v1/orders/:id/cancel - should cancel a PENDING order', async () => {
      const originalTestEnv = process.env.TEST_ENV;
      process.env.TEST_ENV = 'false';

      const payload = { items: [{ itemId: testItemId, quantity: 1 }] };
      const created = await request(app.getHttpServer())
        .post('/v1/orders')
        .set('idempotency-key', 'order-cancel-key')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(HttpStatus.CREATED);
      const orderId = created.body.data.id;

      const res = await request(app.getHttpServer())
        .patch(`/v1/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);

      expect(res.body.message).toMatch(/cancel/i);

      process.env.TEST_ENV = originalTestEnv;
    });

    it('PATCH /v1/orders/:id/cancel - should return 400 if order is SHIPPED', async () => {
      const originalTestEnv = process.env.TEST_ENV;
      process.env.TEST_ENV = 'false';

      const payload = { items: [{ itemId: testItemId, quantity: 1 }] };
      const created = await request(app.getHttpServer())
        .post('/v1/orders')
        .set('idempotency-key', 'order-cancel-shipped-key')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(HttpStatus.CREATED);
      const orderId = created.body.data.id;

      await dataSource.query(`UPDATE orders SET status = 'SHIPPED' WHERE id = $1`, [
        orderId,
      ]);

      await request(app.getHttpServer())
        .patch(`/v1/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.BAD_REQUEST);

      process.env.TEST_ENV = originalTestEnv;
    });

    it('PATCH /v1/orders/:id/refund - should enqueue refund for a PAID order', async () => {
      const originalTestEnv = process.env.TEST_ENV;
      process.env.TEST_ENV = 'false';

      const payload = { items: [{ itemId: testItemId, quantity: 1 }] };
      const created = await request(app.getHttpServer())
        .post('/v1/orders')
        .set('idempotency-key', 'order-refund-key')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(HttpStatus.CREATED);
      const orderId = created.body.data.id;

      // Advance order to PAID status directly in DB
      await dataSource.query(`UPDATE orders SET status = 'PAID' WHERE id = $1`, [
        orderId,
      ]);

      const res = await request(app.getHttpServer())
        .patch(`/v1/orders/${orderId}/refund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);

      expect(res.body.message).toMatch(/refund/i);

      process.env.TEST_ENV = originalTestEnv;
    });

    it('PATCH /v1/orders/:id/refund - should return 400 if order is PENDING', async () => {
      const originalTestEnv = process.env.TEST_ENV;
      process.env.TEST_ENV = 'false';

      const payload = { items: [{ itemId: testItemId, quantity: 1 }] };
      const created = await request(app.getHttpServer())
        .post('/v1/orders')
        .set('idempotency-key', 'order-refund-pending-key')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(HttpStatus.CREATED);
      const orderId = created.body.data.id;

      // Order is still PENDING — not eligible for refund
      await request(app.getHttpServer())
        .patch(`/v1/orders/${orderId}/refund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.BAD_REQUEST);

      process.env.TEST_ENV = originalTestEnv;
    });
  });
});
