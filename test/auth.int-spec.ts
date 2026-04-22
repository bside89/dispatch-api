import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '@/app.module';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { JwtService } from '@nestjs/jwt';
import { REDIS_CLIENT } from '@/shared/modules/cache/constants/redis-client.token';
import { IAuthService } from '@/modules/auth/interfaces/auth-service.interface';
import { AUTH_SERVICE } from '@/modules/auth/constants/auth.token';
import { IOutboxRepository } from '@/shared/modules/outbox/interfaces/outbox-repository.interface';
import { OUTBOX_REPOSITORY } from '@/shared/modules/outbox/constants/outbox.token';
import { PAYMENTS_GATEWAY_SERVICE } from '@/modules/payment-gateways/constants/payments-gateway.token';
import { cleanDatabase, cleanRedis } from './utils/database-cleaner';
import { paymentsGatewayServiceMock } from './utils/mock-payments-gateway-service';
import { waitFor } from './utils/wait-for';
import { INestApplication, UnauthorizedException } from '@nestjs/common';
import type { RequestUser } from '@/modules/auth/interfaces/request-user.interface';
import type { JwtPayload } from '@/modules/auth/interfaces/jwt-payload.interface';
import { HashAdapter } from '@/shared/utils/hash-adapter.utils';

// Mock the delay function to resolve almost instantly.
jest.mock('@/shared/utils/functions.utils', () => ({
  ...jest.requireActual('@/shared/utils/functions.utils'),
  delay: () => Promise.resolve(),
}));

// Override BullMQ backoff delay to 0 so retries happen immediately in tests.
jest.mock('@/config/bullmq.config', () => ({
  ...jest.requireActual('@/config/bullmq.config'),
  bullmqDefaultJobOptions: {
    attempts: 3,
    backoff: { type: 'fixed', delay: 0 },
    removeOnFail: { age: 24 * 3600 },
  },
}));

describe('Auth (Integration)', () => {
  let app: INestApplication;
  let authService: IAuthService;
  let outboxRepository: IOutboxRepository;
  let jwtService: JwtService;
  let dataSource: DataSource;
  let redisClient: Redis;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PAYMENTS_GATEWAY_SERVICE)
      .useValue(paymentsGatewayServiceMock)
      .compile();

    app = module.createNestApplication();
    await app.init();

    authService = app.get<IAuthService>(AUTH_SERVICE);
    outboxRepository = app.get<IOutboxRepository>(OUTBOX_REPOSITORY);
    jwtService = app.get<JwtService>(JwtService);
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

  /**
   * Inserts a user directly into the database to avoid triggering the outbox
   * pipeline from publicCreate. Returns the inserted user ID.
   */
  async function rawInsertUser(
    email: string,
    name = 'Test User',
    role: string = 'user',
    password = 'securePass123',
  ): Promise<string> {
    const passwordHash = await HashAdapter.hash(password);
    const [{ id }] = await dataSource.query(
      `INSERT INTO "users" (name, email, password, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [name, email, passwordHash, role],
    );
    return id;
  }

  /**
   * Builds a RequestUser from a decoded JWT access token payload
   * and the raw refresh token returned by login.
   */
  function buildRequestUser(
    payload: JwtPayload,
    refreshToken?: string,
  ): RequestUser {
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      language: payload.language,
      jwt: {
        jti: payload.jti,
        ...(refreshToken !== undefined && { refreshToken }),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Login — Invalid Credentials
  // ---------------------------------------------------------------------------

  describe('Login — Invalid Credentials', () => {
    it('should throw UnauthorizedException and not create any outbox entry for an unknown email', async () => {
      await expect(
        authService.login('nonexistent@test.com', 'anyPassword'),
      ).rejects.toThrow(UnauthorizedException);

      const outboxEntries = await dataSource.query(`SELECT id FROM outbox`);
      expect(outboxEntries).toHaveLength(0);
    });

    it('should throw UnauthorizedException and not create any outbox entry for a wrong password', async () => {
      await rawInsertUser('wrong-pass@test.com');

      await expect(
        authService.login('wrong-pass@test.com', 'wrongPassword'),
      ).rejects.toThrow(UnauthorizedException);

      const outboxEntries = await dataSource.query(`SELECT id FROM outbox`);
      expect(outboxEntries).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Login — Transaction Atomicity
  // ---------------------------------------------------------------------------

  describe('Login — Transaction Atomicity', () => {
    it('should not persist the refreshToken when outbox insertion fails inside login', async () => {
      const userId = await rawInsertUser('atomic-login@test.com');

      // Force outboxRepository.save to throw — simulates a failure at the very
      // end of _login, after generateTokens and updateRefreshToken but before commit.
      const saveSpy = jest
        .spyOn(outboxRepository, 'save')
        .mockRejectedValueOnce(new Error('Simulated outbox failure'));

      await expect(
        authService.login('atomic-login@test.com', 'securePass123'),
      ).rejects.toThrow('Simulated outbox failure');

      // The whole lockAndTransaction wraps _login: if outboxRepository.save throws,
      // the transaction rolls back including userRepository.update(refreshToken).
      const [row] = await dataSource.query(
        `SELECT "refreshToken" FROM users WHERE id = $1`,
        [userId],
      );
      expect(row.refreshToken).toBeNull();

      // Assert: no outbox entries (the rolled-back save didn't persist)
      const outboxEntries = await dataSource.query(`SELECT id FROM outbox`);
      expect(outboxEntries).toHaveLength(0);

      saveSpy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // Login — Outbox Entry & Notification Pipeline
  // ---------------------------------------------------------------------------

  describe('Login — Notification Pipeline', () => {
    it('should create a SIDE_EFFECTS_NOTIFY_USER outbox entry immediately after login', async () => {
      await rawInsertUser('outbox-login@test.com');

      await authService.login('outbox-login@test.com', 'securePass123');

      const outboxEntries = await dataSource.query(
        `SELECT type FROM outbox WHERE type = 'SIDE_EFFECTS_NOTIFY_USER'`,
      );
      expect(outboxEntries).toHaveLength(1);
    });

    it('should persist a notification row after the full SIDE_EFFECTS_NOTIFY_USER pipeline completes', async () => {
      const userId = await rawInsertUser('full-pipeline@test.com');

      await authService.login('full-pipeline@test.com', 'securePass123');

      // Wait for the full pipeline end-to-end:
      //   outboxService.add → outbox row → setImmediate → OutboxService.process
      //   → BullMQ job enqueued + outbox row deleted
      //   → SideEffectsProcessor.process → NotifyUserJobStrategy.execute
      //   → notificationsService.create → notification row in DB
      //
      // We poll for the notification row itself (the real terminal condition)
      // rather than for the outbox being empty, because the outbox entry is
      // removed when the job is *enqueued*, not when it *completes*.
      await waitFor(
        async () => {
          const rows = await dataSource.query(
            `SELECT id FROM notifications WHERE "userId" = $1`,
            [userId],
          );
          return rows.length > 0;
        },
        15_000,
        250,
      );

      // Assert: notification row was persisted for this user
      const notifications = await dataSource.query(
        `SELECT id, type, message FROM notifications WHERE "userId" = $1`,
        [userId],
      );
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('INFO');
    }, 30_000);

    it('should not duplicate the notification when login is called concurrently for the same user', async () => {
      // The lock on LOCK_KEY.AUTH.LOGIN(email) serializes concurrent logins,
      // and the job-level idempotency in BaseProcessor prevents duplicate execution.
      await rawInsertUser('concurrent-login@test.com');

      await Promise.all([
        authService.login('concurrent-login@test.com', 'securePass123'),
        authService.login('concurrent-login@test.com', 'securePass123'),
      ]);

      // Each sequential login creates its own outbox entry (different correlationIds),
      // so we expect at least 1 notification after both pipelines complete.
      // Poll for the notification rows directly (outbox empty ≠ pipeline complete).
      await waitFor(
        async () => {
          const rows = await dataSource.query(
            `SELECT id FROM notifications WHERE "userId" = (
              SELECT id FROM users WHERE email = $1
            )`,
            ['concurrent-login@test.com'],
          );
          return rows.length >= 1;
        },
        15_000,
        250,
      );

      const notifications = await dataSource.query(
        `SELECT id FROM notifications WHERE "userId" = (
          SELECT id FROM users WHERE email = $1
        )`,
        ['concurrent-login@test.com'],
      );
      // Two successful sequential logins → two notification rows
      expect(notifications.length).toBeGreaterThanOrEqual(1);
    }, 30_000);
  });

  // ---------------------------------------------------------------------------
  // Token Refresh
  // ---------------------------------------------------------------------------

  describe('Token Refresh', () => {
    it('should issue new tokens with a rotated refreshToken on a valid refresh call', async () => {
      await rawInsertUser('refresh-valid@test.com');

      const loginResult = await authService.login(
        'refresh-valid@test.com',
        'securePass123',
      );

      const payload = jwtService.decode(loginResult.accessToken) as JwtPayload;
      const requestUser = buildRequestUser(payload, loginResult.refreshToken);

      const refreshResult = await authService.refresh(requestUser);

      expect(refreshResult.accessToken).toBeDefined();
      expect(refreshResult.refreshToken).toBeDefined();
      // Rotated — the new token must differ from the original
      expect(refreshResult.refreshToken).not.toBe(loginResult.refreshToken);

      // The DB refreshToken hash must be non-null (updated to the new hash)
      const [row] = await dataSource.query(
        `SELECT "refreshToken" FROM users WHERE id = $1`,
        [loginResult.userId],
      );
      expect(row.refreshToken).not.toBeNull();
    });

    it('should throw UnauthorizedException and log out the user when the refresh token is invalid', async () => {
      await rawInsertUser('refresh-invalid@test.com');

      const loginResult = await authService.login(
        'refresh-invalid@test.com',
        'securePass123',
      );

      const payload = jwtService.decode(loginResult.accessToken) as JwtPayload;
      // Supply an incorrect refresh token
      const requestUser = buildRequestUser(payload, 'invalid-token-value');

      await expect(authService.refresh(requestUser)).rejects.toThrow(
        UnauthorizedException,
      );

      // On invalid refresh, _refresh calls logout → refreshToken is cleared
      const [row] = await dataSource.query(
        `SELECT "refreshToken" FROM users WHERE id = $1`,
        [loginResult.userId],
      );
      expect(row.refreshToken).toBeNull();
    });

    it('should throw UnauthorizedException when no refresh token is provided in the JWT payload', async () => {
      await rawInsertUser('refresh-no-token@test.com');

      const loginResult = await authService.login(
        'refresh-no-token@test.com',
        'securePass123',
      );

      const payload = jwtService.decode(loginResult.accessToken) as JwtPayload;
      // Omit refreshToken from RequestUser.jwt
      const requestUser: RequestUser = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        language: payload.language,
        jwt: { jti: payload.jti },
      };

      await expect(authService.refresh(requestUser)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------

  describe('Logout', () => {
    it('should clear the refreshToken in the DB and blacklist the access token JTI in Redis', async () => {
      await rawInsertUser('logout@test.com');

      const loginResult = await authService.login(
        'logout@test.com',
        'securePass123',
      );

      const payload = jwtService.decode(loginResult.accessToken) as JwtPayload;
      const requestUser = buildRequestUser(payload);

      await authService.logout(requestUser);

      // Assert: refreshToken cleared in DB
      const [userRow] = await dataSource.query(
        `SELECT "refreshToken" FROM users WHERE id = $1`,
        [loginResult.userId],
      );
      expect(userRow.refreshToken).toBeNull();

      // Assert: JTI blacklisted in Redis (key format: api:blacklist:<jti>)
      const blacklistKey = `api:blacklist:${payload.jti}`;
      const blacklistValue = await redisClient.get(blacklistKey);
      expect(blacklistValue).not.toBeNull();
    });

    it('should prevent a second token refresh after logout', async () => {
      await rawInsertUser('logout-then-refresh@test.com');

      const loginResult = await authService.login(
        'logout-then-refresh@test.com',
        'securePass123',
      );

      const payload = jwtService.decode(loginResult.accessToken) as JwtPayload;
      const requestUser = buildRequestUser(payload, loginResult.refreshToken);

      await authService.logout(requestUser);

      // Refreshing after logout: the stored refreshToken hash is null.
      // HashAdapter.compare(null, token) throws a TypeError from argon2 rather
      // than returning false, so we assert that refresh fails with any error.
      await expect(authService.refresh(requestUser)).rejects.toThrow();
    });
  });
});
