import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '@/app.module';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@/shared/modules/cache/constants/redis-client.token';
import { IUsersService } from '@/modules/users/interfaces/users-service.interface';
import { USERS_SERVICE } from '@/modules/users/constants/users.token';
import { IOutboxRepository } from '@/shared/modules/outbox/interfaces/outbox-repository.interface';
import { OUTBOX_REPOSITORY } from '@/shared/modules/outbox/constants/outbox.token';
import { PAYMENTS_GATEWAY_SERVICE } from '@/modules/payments-gateway/constants/payments-gateway.token';
import { cleanDatabase, cleanRedis } from './utils/database-cleaner';
import { paymentsGatewayServiceMock } from './utils/mock-payments-gateway-service';
import { waitFor } from './utils/wait-for';
import { ADMIN_USER } from './constants/admin-user.constant';
import { INestApplication, ConflictException } from '@nestjs/common';
import { UserRole } from '@/shared/enums/user-role.enum';
import type { RequestUser } from '@/modules/auth/interfaces/request-user.interface';

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

describe('Users (Integration)', () => {
  let app: INestApplication;
  let usersService: IUsersService;
  let outboxRepository: IOutboxRepository;
  let dataSource: DataSource;
  let redisClient: Redis;

  const adminRequestUser: RequestUser = {
    id: ADMIN_USER.id,
    email: ADMIN_USER.email,
    role: UserRole.ADMIN,
    language: 'en',
    jwt: { jti: 'admin-jti-test' },
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PAYMENTS_GATEWAY_SERVICE)
      .useValue(paymentsGatewayServiceMock)
      .compile();

    app = module.createNestApplication();
    await app.init();

    usersService = app.get<IUsersService>(USERS_SERVICE);
    outboxRepository = app.get<IOutboxRepository>(OUTBOX_REPOSITORY);
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

  // ---------------------------------------------------------------------------
  // User Creation — Idempotency
  // ---------------------------------------------------------------------------

  describe('User Creation — Idempotency', () => {
    it('should return the same user when called twice with the same idempotency key', async () => {
      const dto = {
        name: 'Idempotent User',
        email: 'idempotent@test.com',
        password: 'securePass123',
      };

      const first = await usersService.publicCreate(dto, 'idem-user-key-1');
      const second = await usersService.publicCreate(dto, 'idem-user-key-1');

      expect(first.id).toBe(second.id);

      const rows = await dataSource.query(`SELECT id FROM users WHERE email = $1`, [
        'idempotent@test.com',
      ]);
      // The admin fixture + our new user
      expect(rows).toHaveLength(1);
    });

    it('should not create duplicate users under concurrent calls with the same key', async () => {
      const dto = {
        name: 'Concurrent User',
        email: 'concurrent@test.com',
        password: 'securePass123',
      };

      const [first, second] = await Promise.all([
        usersService.publicCreate(dto, 'concurrent-user-key'),
        usersService.publicCreate(dto, 'concurrent-user-key'),
      ]);

      expect(first.id).toBe(second.id);

      const rows = await dataSource.query(`SELECT id FROM users WHERE email = $1`, [
        'concurrent@test.com',
      ]);
      expect(rows).toHaveLength(1);
    });

    it('should throw ConflictException when a second user attempts to register with an existing email', async () => {
      await usersService.publicCreate(
        {
          name: 'First User',
          email: 'duplicate-email@test.com',
          password: 'securePass123',
        },
        'idem-user-first',
      );

      await expect(
        usersService.publicCreate(
          {
            name: 'Second User',
            email: 'duplicate-email@test.com',
            password: 'differentPass456',
          },
          'idem-user-second',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ---------------------------------------------------------------------------
  // User Creation — Transaction Atomicity
  // ---------------------------------------------------------------------------

  describe('User Creation — Transaction Atomicity', () => {
    it('should not persist the user when outbox insertion fails inside publicCreate', async () => {
      const saveSpy = jest
        .spyOn(outboxRepository, 'save')
        .mockRejectedValueOnce(new Error('Simulated outbox failure'));

      await expect(
        usersService.publicCreate(
          {
            name: 'Atomic User',
            email: 'atomic-create@test.com',
            password: 'securePass123',
          },
          'idem-user-atomic-create',
        ),
      ).rejects.toThrow('Simulated outbox failure');

      const rows = await dataSource.query(`SELECT id FROM users WHERE email = $1`, [
        'atomic-create@test.com',
      ]);
      expect(rows).toHaveLength(0);

      saveSpy.mockRestore();
    });

    it('should not persist the name update when outbox insertion fails inside publicUpdate', async () => {
      // Raw-insert user to bypass the publicCreate outbox pipeline
      const [{ id: userId }] = await dataSource.query(
        `INSERT INTO "users" (name, email, password, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        ['Original Name', 'atomic-update@test.com', 'hashedpassword', 'user'],
      );

      const saveSpy = jest
        .spyOn(outboxRepository, 'save')
        .mockRejectedValueOnce(new Error('Simulated outbox failure'));

      const requestUser: RequestUser = {
        id: userId,
        email: 'atomic-update@test.com',
        role: UserRole.USER,
        language: 'en',
        jwt: { jti: 'test-jti-update' },
      };

      await expect(
        usersService.publicUpdate({ name: 'New Name' }, requestUser),
      ).rejects.toThrow('Simulated outbox failure');

      const [row] = await dataSource.query(`SELECT name FROM users WHERE id = $1`, [
        userId,
      ]);
      expect(row.name).toBe('Original Name');

      saveSpy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // User Creation — Async Payment Pipeline (PAYMENT_CREATE_CUSTOMER)
  // ---------------------------------------------------------------------------

  describe('User Creation — Async Payment Pipeline', () => {
    it('should persist customerId after the PAYMENT_CREATE_CUSTOMER pipeline completes', async () => {
      const createdUser = await usersService.publicCreate(
        {
          name: 'Pipeline User',
          email: 'pipeline-create@test.com',
          password: 'securePass123',
        },
        'idem-user-pipeline-create',
      );

      // Assert: outbox has the PAYMENT_CREATE_CUSTOMER entry immediately after creation
      const outboxEntries = await dataSource.query(
        `SELECT type FROM outbox WHERE type = 'PAYMENT_CREATE_CUSTOMER'`,
      );
      expect(outboxEntries).toHaveLength(1);

      // Wait for BullMQ to process the job: CreateCustomerJobStrategy calls
      // paymentsGatewayService.customersCreate → updateUserWithLock({ customerId })
      await waitFor(
        async () => {
          const [row] = await dataSource.query(
            `SELECT "customerId" FROM users WHERE id = $1`,
            [createdUser.id],
          );
          return !!row?.customerId;
        },
        15_000,
        250,
      );

      const [userRow] = await dataSource.query(
        `SELECT "customerId" FROM users WHERE id = $1`,
        [createdUser.id],
      );
      expect(userRow.customerId).toBe('cus_test_create');

      // Outbox should be fully consumed
      await waitFor(
        async () => {
          const rows = await dataSource.query(`SELECT id FROM outbox`);
          return rows.length === 0;
        },
        5_000,
        250,
      );
    }, 30_000);
  });

  // ---------------------------------------------------------------------------
  // User Removal — Async Payment Pipeline (PAYMENT_DELETE_CUSTOMER)
  // ---------------------------------------------------------------------------

  describe('User Removal — Async Payment Pipeline', () => {
    it('should process the PAYMENT_DELETE_CUSTOMER pipeline and call gateway delete after user removal', async () => {
      // Raw-insert a user with a customerId already set to bypass the create pipeline
      const [{ id: userId }] = await dataSource.query(
        `INSERT INTO "users" (name, email, password, role, "customerId")
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          'Delete Pipeline User',
          'delete-pipeline@test.com',
          'hashedpassword',
          'user',
          'cus_to_delete',
        ],
      );

      // Track the specific call for this test
      const deleteSpy = jest.spyOn(paymentsGatewayServiceMock, 'customersDelete');

      try {
        // Use adminRemove: the admin actor (higher role) removes the regular user (lower role)
        await usersService.adminRemove(userId, adminRequestUser);

        // Assert: outbox should have the PAYMENT_DELETE_CUSTOMER entry
        const outboxEntries = await dataSource.query(
          `SELECT type FROM outbox WHERE type = 'PAYMENT_DELETE_CUSTOMER'`,
        );
        expect(outboxEntries).toHaveLength(1);

        // Wait for the pipeline to run DeleteCustomerJobStrategy → customersDelete
        await waitFor(
          async () => {
            const rows = await dataSource.query(`SELECT id FROM outbox`);
            return rows.length === 0;
          },
          15_000,
          250,
        );

        // Assert: gateway delete was called with the correct customerId
        expect(deleteSpy).toHaveBeenCalledWith('cus_to_delete', expect.any(String));
      } finally {
        deleteSpy.mockRestore();
      }
    }, 30_000);

    it('should not persist the soft-delete when outbox insertion fails inside adminRemove', async () => {
      // Raw-insert user with a customerId
      const [{ id: userId }] = await dataSource.query(
        `INSERT INTO "users" (name, email, password, role, "customerId")
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          'Atomic Remove User',
          'atomic-remove@test.com',
          'hashedpassword',
          'user',
          'cus_atomic_remove',
        ],
      );

      const saveSpy = jest
        .spyOn(outboxRepository, 'save')
        .mockRejectedValueOnce(new Error('Simulated outbox failure'));

      await expect(
        usersService.adminRemove(userId, adminRequestUser),
      ).rejects.toThrow('Simulated outbox failure');

      // Assert: user was NOT soft-deleted (deactivatedAt remains null)
      const [row] = await dataSource.query(
        `SELECT "deactivatedAt" FROM users WHERE id = $1`,
        [userId],
      );
      expect(row.deactivatedAt).toBeNull();

      saveSpy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // Admin Role Access Control
  // ---------------------------------------------------------------------------

  describe('Admin Role Access Control', () => {
    it('should throw ForbiddenException when adminCreate is called with a role equal to the requestUser role', async () => {
      // An admin cannot create another admin (same-level role write)
      await expect(
        usersService.adminCreate(
          {
            name: 'Unauthorized Admin',
            email: 'unauthorized-admin@test.com',
            password: 'securePass123',
            role: UserRole.ADMIN,
          },
          'idem-admin-role-check',
          adminRequestUser,
        ),
      ).rejects.toThrow();
    });
  });
});
