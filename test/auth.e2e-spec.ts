import { HttpStatus, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ADMIN_USER } from './constants/admin-user.constant';
import { cleanDatabase, cleanRedis } from './utils/database-cleaner';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { JwtService } from '@nestjs/jwt';
import {
  createAccessToken,
  createRefreshToken,
  getAdminFixture,
  persistRefreshToken,
} from './utils/e2e-fixtures';
import { createTestApp } from './utils/e2e-setup';

describe('Auth (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let redisClient: Redis;
  let jwtService: JwtService;

  beforeAll(async () => {
    ({ app, dataSource, redisClient, jwtService } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  }, 30000);

  beforeEach(async () => {
    await cleanDatabase(dataSource);
    await cleanRedis(redisClient);
  });

  describe('REST Endpoints', () => {
    it('POST /v1/auth/login - should deny access with incorrect email/password', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: 'wrong@test.com',
          password: 'WrongPassword123!',
        })
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('POST /v1/auth/login - should authenticate Admin user and return tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: ADMIN_USER.email,
          password: ADMIN_USER.password,
        })
        .expect(HttpStatus.CREATED);

      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
    });

    it('POST /v1/auth/refresh - should deny access with incorrect refreshToken', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .set('Authorization', `Bearer invalid-token`)
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('POST /v1/auth/refresh - should return new accessToken and refreshToken', async () => {
      const adminUser = getAdminFixture();
      const validRefreshToken = createRefreshToken(jwtService, adminUser);

      await persistRefreshToken(dataSource, adminUser.id, validRefreshToken);

      const refreshRes = await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .set('Authorization', `Bearer ${validRefreshToken}`)
        .expect(HttpStatus.CREATED);

      expect(refreshRes.body.data).toHaveProperty('accessToken');
      expect(refreshRes.body.data).toHaveProperty('refreshToken');
      expect(refreshRes.body.data.refreshToken).not.toBe(validRefreshToken);
    });

    it('POST /v1/auth/logout - should deny access with incorrect accessToken', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/logout')
        .set('Authorization', `Bearer invalid-token`)
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('POST /v1/auth/logout - should authenticate Admin and successfully logout, blacklisting token', async () => {
      const adminUser = getAdminFixture();
      const validAccessToken = createAccessToken(jwtService, adminUser);

      await request(app.getHttpServer())
        .post('/v1/auth/logout')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .expect(HttpStatus.CREATED);

      await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .expect(HttpStatus.UNAUTHORIZED);

      await request(app.getHttpServer())
        .get('/v1/users')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });
});
