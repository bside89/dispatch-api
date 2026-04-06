import { AppModule } from '@/app.module';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { ADMIN_USER } from './constants/admin-user.constant';
import { cleanDatabase, cleanRedis } from './utils/database-cleaner';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@/shared/constants/redis-client.constant';

describe('Orders (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let redisClient: Redis;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase(dataSource);
    await cleanRedis(redisClient);
  });

  describe('POST /v1/orders', () => {
    it('should return 400 if payload is empty', async () => {
      // First obtain the jwt token
      const { body } = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: ADMIN_USER.email,
          password: ADMIN_USER.password,
        })
        .expect(201);

      const token = body.data.accessToken;

      // Then make the request to create an order with the token
      return request(app.getHttpServer())
        .post('/v1/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);
    });

    it('should create order and return 201', async () => {
      const payload = {
        items: [
          {
            productId: 'product-123',
            quantity: 2,
            price: 14999,
          },
        ],
      };

      const { body: authBody } = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: ADMIN_USER.email,
          password: ADMIN_USER.password,
        })
        .expect(201);

      const token = authBody.data.accessToken;

      const { body: orderBody } = await request(app.getHttpServer())
        .post('/v1/orders')
        .set('idempotency-key', 'e2e-test-key')
        .set('Authorization', `Bearer ${token}`)
        .send(payload)
        .expect(201);

      expect(orderBody.data.id).toBeDefined();
      expect(orderBody.data.status).toBe('PENDING');
    });

    it('should return the same order on duplicate idempotency key', async () => {
      const payload = {
        items: [
          {
            productId: 'product-123',
            quantity: 2,
            price: 14999,
          },
        ],
      };
      const key = 'duplicate-key';

      const { body: authBody } = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: ADMIN_USER.email,
          password: ADMIN_USER.password,
        })
        .expect(201);

      const token = authBody.data.accessToken;

      const { body: result1 } = await request(app.getHttpServer())
        .post('/v1/orders')
        .set('idempotency-key', key)
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      // Segunda tentativa com a mesma chave
      const { body: result2 } = await request(app.getHttpServer())
        .post('/v1/orders')
        .set('idempotency-key', key)
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(result2.data.id).toBe(result1.data.id);
      expect(result2.data.status).toBe(result1.data.status);
    });
  });
});
