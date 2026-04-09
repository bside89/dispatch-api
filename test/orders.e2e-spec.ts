import { AppModule } from '@/app.module';
import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { ADMIN_USER } from './constants/admin-user.constant';
import { cleanDatabase, cleanRedis } from './utils/database-cleaner';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@/shared/constants/redis-client.constant';
import { PaymentsService } from '@/modules/payments/payments.service';
import { OutboxRepository } from '@/shared/modules/outbox/repositories/outbox.repository';
import { paymentsServiceMock } from './utils/mock-payments-service';

describe('Orders (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let redisClient: Redis;
  let outboxRepository: OutboxRepository;

  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PaymentsService)
      .useValue(paymentsServiceMock)
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
            productId: 'product-100',
            quantity: 3,
            price: 15999,
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
            productId: 'product-123',
            quantity: 2,
            price: 14999,
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
            productId: 'product-123',
            quantity: 2,
            price: 14999,
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
          items: [{ productId: 'product-rollback', quantity: 1, price: 7500 }],
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

    it('GET /v1/orders/:id - should get a specific order', async () => {
      // First create
      const payload = {
        items: [{ productId: 'product-xyz', quantity: 1, price: 5000 }],
      };
      const created = await request(app.getHttpServer())
        .post('/v1/orders')
        .set('idempotency-key', 'order-get-key')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(HttpStatus.CREATED);

      const orderId = created.body.data.id;

      const res = await request(app.getHttpServer())
        .get(`/v1/orders/${orderId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(HttpStatus.OK);

      expect(res.body.data.id).toBe(orderId);
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
        items: [{ productId: 'product-xyz', quantity: 1, price: 5000 }],
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
        .send({ items: [{ productId: 'product-xyz-2', quantity: 1, price: 6000 }] })
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
        items: [{ productId: 'product-xyz', quantity: 1, price: 5000 }],
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

      const payload = { items: [{ productId: 'delete', quantity: 1, price: 10 }] };
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
