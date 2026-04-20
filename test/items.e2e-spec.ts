import { AppModule } from '@/app.module';
import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import Redis from 'ioredis';
import request from 'supertest';
import { PAYMENTS_GATEWAY_SERVICE } from '@/modules/payments-gateway/constants/payments-gateway.token';
import { REDIS_CLIENT } from '@/shared/modules/cache/constants/redis-client.token';
import { DataSource } from 'typeorm';
import { cleanDatabase, cleanRedis } from './utils/database-cleaner';
import { paymentsGatewayServiceMock } from './utils/mock-payments-gateway-service';
import {
  createAccessToken,
  createFixtureItem,
  createFixtureUser,
  getAdminFixture,
} from './utils/e2e-fixtures';

describe('Items (E2E)', () => {
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
      .overrideProvider(PAYMENTS_GATEWAY_SERVICE)
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
    it('GET /v1/items - should return 401 if no jwt token is provided', async () => {
      await request(app.getHttpServer())
        .get('/v1/items')
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('GET /v1/items - should return the public items list for an authenticated user', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/items')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(HttpStatus.OK);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].id).toBe(testItemId);
      expect(res.body.items[0]).not.toHaveProperty('pricePaymentId');
    });

    it('GET /v1/items/:id - should return a public item without admin-only fields', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/items/${testItemId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(HttpStatus.OK);

      expect(res.body.data.id).toBe(testItemId);
      expect(res.body.data).not.toHaveProperty('pricePaymentId');
    });

    it('POST /v1/admin/items - should forbid a regular user', async () => {
      await request(app.getHttpServer())
        .post('/v1/admin/items')
        .set('idempotency-key', 'items-forbidden-key')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Forbidden Item',
          description: 'Should not be created by a regular user',
          stock: 5,
          price: 1999,
        })
        .expect(HttpStatus.FORBIDDEN);
    });

    it('GET /v1/admin/items - should forbid a regular user', async () => {
      await request(app.getHttpServer())
        .get('/v1/admin/items')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('POST /v1/admin/items - should create an item and return 201', async () => {
      const payload = {
        name: 'Wireless Keyboard',
        description: 'Mechanical keyboard with low latency',
        stock: 10,
        price: 12999,
        pricePaymentId: 'price_keyboard_123',
      };

      const res = await request(app.getHttpServer())
        .post('/v1/admin/items')
        .set('idempotency-key', 'items-create-key')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(HttpStatus.CREATED);

      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.name).toBe(payload.name);
      expect(res.body.data.pricePaymentId).toBe(payload.pricePaymentId);
    });

    it('POST /v1/admin/items - should return the same item on duplicate idempotency key', async () => {
      const payload = {
        name: 'Noise Cancelling Headset',
        description: 'Headset with active noise cancellation',
        stock: 7,
        price: 18999,
        pricePaymentId: 'price_headset_123',
      };
      const key = 'items-duplicate-key';

      const result1 = await request(app.getHttpServer())
        .post('/v1/admin/items')
        .set('idempotency-key', key)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(HttpStatus.CREATED);

      const result2 = await request(app.getHttpServer())
        .post('/v1/admin/items')
        .set('idempotency-key', key)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(HttpStatus.CREATED);

      expect(result2.body.data.id).toBe(result1.body.data.id);
      expect(result2.body.data.pricePaymentId).toBe(
        result1.body.data.pricePaymentId,
      );
    });

    it('GET /v1/admin/items - should return the admin items list with full details', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/admin/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].id).toBe(testItemId);
      expect(res.body.items[0]).toHaveProperty('pricePaymentId', null);
    });

    it('GET /v1/admin/items/:id - should return an item with admin-only fields', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/admin/items/${testItemId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);

      expect(res.body.data.id).toBe(testItemId);
      expect(res.body.data).toHaveProperty('pricePaymentId', null);
    });

    it('PATCH /v1/admin/items/:id - should update an item', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/v1/admin/items/${testItemId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated Test Product',
          stock: 25,
        })
        .expect(HttpStatus.OK);

      expect(res.body.data.id).toBe(testItemId);
      expect(res.body.data.name).toBe('Updated Test Product');
      expect(res.body.data.stock).toBe(25);
    });

    it('DELETE /v1/admin/items/:id - should remove an item', async () => {
      await request(app.getHttpServer())
        .delete(`/v1/admin/items/${testItemId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.NO_CONTENT);

      await request(app.getHttpServer())
        .get(`/v1/admin/items/${testItemId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });
  });
});
