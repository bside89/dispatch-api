import { AppModule } from '@/app.module';
import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { ADMIN_USER } from './constants/admin-user.constant';
import { cleanDatabase, cleanRedis } from './utils/database-cleaner';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@/shared/constants/redis-client.constant';
import { paymentsGatewayServiceMock } from './utils/mock-payments-gateway-service';
import { PaymentsGatewayService } from '@/modules/payments-gateway/payments-gateway.service';

describe('Users (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let redisClient: Redis;

  let adminToken: string;
  let userToken: string;
  let createdUserId: string;

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
  });

  afterAll(async () => {
    await app.close();
  });

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

    const { body: userCreated } = await request(app.getHttpServer())
      .post('/v1/users')
      .set('idempotency-key', `setup-${randomSuffix}`)
      .send(userPayload)
      .expect(HttpStatus.CREATED);

    createdUserId = userCreated.data.id;

    // Login as regular user
    const { body: userAuth } = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({
        email: userPayload.email,
        password: userPayload.password,
      })
      .expect(HttpStatus.CREATED);
    userToken = userAuth.data.accessToken;
  });

  describe('REST Endpoints', () => {
    it('POST /v1/users - should create a user', async () => {
      const randomSuffix = Math.random().toString(36).substring(7);
      const payload = {
        name: 'New User',
        email: `new.user-${randomSuffix}@test.com`,
        password: 'Password123!',
      };

      const res = await request(app.getHttpServer())
        .post('/v1/users')
        .set('idempotency-key', `create-${randomSuffix}`)
        .send(payload)
        .expect(HttpStatus.CREATED);

      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.email).toBe(payload.email);
    });

    it('POST /v1/users - should reject without idempotency key', async () => {
      const payload = {
        name: 'No Key User',
        email: 'nokey@test.com',
        password: 'Password123!',
      };

      await request(app.getHttpServer())
        .post('/v1/users')
        .send(payload)
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('GET /v1/users - should return users list (requires auth)', async () => {
      // Missing auth
      await request(app.getHttpServer())
        .get('/v1/users')
        .expect(HttpStatus.UNAUTHORIZED);

      const res = await request(app.getHttpServer())
        .get('/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);

      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('GET /v1/users/:id - should get a specific user', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/users/${createdUserId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(HttpStatus.OK);

      expect(res.body.data.id).toBe(createdUserId);
    });

    it('PATCH /v1/users/:id - should update user information', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/v1/users/${createdUserId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Updated Name' })
        .expect(HttpStatus.OK);

      expect(res.body.data.name).toBe('Updated Name');
    });

    it('PATCH /v1/users/:id/login - should update login credentials', async () => {
      await request(app.getHttpServer())
        .patch(`/v1/users/${createdUserId}/login`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          email: 'regular.new@test.com',
          currentPassword: 'StrongPassword123!',
        })
        .expect(HttpStatus.OK);

      // Verify login works with new email
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: 'regular.new@test.com',
          password: 'StrongPassword123!',
        })
        .expect(HttpStatus.CREATED);
    });

    it('DELETE /v1/users/:id - should block normal user (403 Forbidden)', async () => {
      // Temporarily set TEST_ENV to false so RolesGuard won't bypass the check
      const originalTestEnv = process.env.TEST_ENV;
      process.env.TEST_ENV = 'false';

      // The user lacks ADMIN role and should be forbidden
      await request(app.getHttpServer())
        .delete(`/v1/users/${createdUserId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(HttpStatus.FORBIDDEN); // NestJS Returns 403 when RolesGuard fails

      process.env.TEST_ENV = originalTestEnv;
    });

    it('DELETE /v1/users/:id - should allow admin user', async () => {
      // Temporarily set TEST_ENV to false so RolesGuard won't bypass the check
      const originalTestEnv = process.env.TEST_ENV;
      process.env.TEST_ENV = 'false';

      // The Admin user has ADMIN role and should succeed
      await request(app.getHttpServer())
        .delete(`/v1/users/${createdUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.NO_CONTENT); // DELETE typically returns 204 No Content

      // Verify user is deleted
      await request(app.getHttpServer())
        .get(`/v1/users/${createdUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.NOT_FOUND);

      process.env.TEST_ENV = originalTestEnv;
    });
  });
});
