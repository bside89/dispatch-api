import { AppModule } from '@/app.module';
import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { ADMIN_USER } from './constants/admin-user.constant';
import { cleanDatabase, cleanRedis } from './utils/database-cleaner';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@/shared/constants/redis-client.constant';
import { OutboxRepository } from '@/shared/modules/outbox/repositories/outbox.repository';
import { paymentsGatewayServiceMock } from './utils/mock-payments-gateway-service';
import { PaymentsGatewayService } from '@/modules/payments-gateway/payments-gateway.service';

describe('Orders (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let redisClient: Redis;
  let outboxRepository: OutboxRepository;

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
    outboxRepository = app.get<OutboxRepository>(OutboxRepository);
  });

  afterAll(async () => {
    await app.close();
  }, 30000);

  beforeEach(async () => {
    await cleanDatabase(dataSource);
    await cleanRedis(redisClient);

    // Login as admin
    const { body: adminAuth } = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({
        email: ADMIN_USER.email,
        password: ADMIN_USER.password,
      })
      .expect(HttpStatus.CREATED);
    adminToken = adminAuth.data.accessToken;

    // Create a default test item as admin for order creation
    const { body: itemBody } = await request(app.getHttpServer())
      .post('/v1/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('idempotency-key', `item-setup-${Date.now()}`)
      .send({
        name: 'Test Product',
        description: 'A test product for order tests',
        quantity: 100,
        price: 14999,
      })
      .expect(HttpStatus.CREATED);
    testItemId = itemBody.data.id;

    // Create a regular user for tests
    const randomSuffix = Math.random().toString(36).substring(7);
    const uniqueEmail = `regular-${randomSuffix}@test.com`;
    const userPayload = {
      name: 'Regular Test User',
      email: uniqueEmail,
      password: 'StrongPassword123!',
    };

    await request(app.getHttpServer())
      .post('/v1/users')
      .set('idempotency-key', `setup-${randomSuffix}`)
      .send(userPayload)
      .expect(HttpStatus.CREATED);

    // Login as regular user
    const { body: userAuth } = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({
        email: uniqueEmail,
        password: userPayload.password,
      })
      .expect(HttpStatus.CREATED);
    userToken = userAuth.data.accessToken;
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

    it('POST /v1/orders - should rollback the Order when Outbox insertion fails', async () => {
      const saveSpy = jest
        .spyOn(outboxRepository, 'save')
        .mockRejectedValueOnce(new Error('Simulated Outbox insertion failure'));

      try {
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

        const outboxEntries = await dataSource.query(
          `SELECT id FROM outbox WHERE type = 'ORDER_PROCESS'`,
        );
        expect(outboxEntries).toHaveLength(0);
      } finally {
        saveSpy.mockRestore();
      }
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
        .send({ items: [] })
        .expect(HttpStatus.FORBIDDEN);

      process.env.TEST_ENV = originalTestEnv;
    });

    it('PATCH /v1/orders/:id - should allow admin user', async () => {
      // Temporarily set TEST_ENV to false so RolesGuard won't bypass the check
      const originalTestEnv = process.env.TEST_ENV;
      process.env.TEST_ENV = 'false';

      const payload = {
        items: [{ itemId: testItemId, quantity: 1 }],
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
        .send({ items: [{ itemId: testItemId, quantity: 3 }] })
        .expect(HttpStatus.OK);

      process.env.TEST_ENV = originalTestEnv;
    });

    it('PATCH /v1/orders/:id/status - should block normal user (403 Forbidden)', async () => {
      const originalTestEnv = process.env.TEST_ENV;
      process.env.TEST_ENV = 'false';

      await request(app.getHttpServer())
        .patch('/v1/orders/123e4567-e89b-12d3-a456-426614174000/status')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'PAID' })
        .expect(HttpStatus.FORBIDDEN);

      process.env.TEST_ENV = originalTestEnv;
    });

    it('PATCH /v1/orders/:id/status - should allow admin user', async () => {
      const originalTestEnv = process.env.TEST_ENV;
      process.env.TEST_ENV = 'false';

      const payload = {
        items: [{ itemId: testItemId, quantity: 1 }],
      };
      const created = await request(app.getHttpServer())
        .post('/v1/orders')
        .set('idempotency-key', 'order-update-status-key')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(HttpStatus.CREATED);
      const orderId = created.body.data.id;

      await request(app.getHttpServer())
        .patch(`/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'PAID' })
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
  });
});
