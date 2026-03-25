/**
 * E2E test: POST /orders → DELIVERED
 *
 * Bootstraps the full NestJS application with mocked DB / Redis / BullMQ
 * so it can run in CI without external services.
 *
 * Flow:
 *   1. POST /api/v1/users  → create a test user
 *   2. POST /api/v1/auth/login → obtain JWT access token
 *   3. POST /api/v1/orders → create an order (status: PENDING, PROCESS_ORDER job enqueued)
 *   4. Drive the strategy chain manually: PROCESS → SHIP → DELIVER
 *   5. GET  /api/v1/orders/:id → assert final status is DELIVERED
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import { AppModule } from '../src/app.module';
import { Order } from '../src/modules/order/entities/order.entity';
import { OrderItem } from '../src/modules/order/entities/order-item.entity';
import { User } from '../src/modules/user/entities/user.entity';
import { OrderStatus } from '../src/modules/order/enums/order-status.enum';
import { ProcessOrderStrategy } from '../src/modules/order/strategies/process-order.strategy';
import { ShipOrderStrategy } from '../src/modules/order/strategies/ship-order.strategy';
import { DeliverOrderStrategy } from '../src/modules/order/strategies/deliver-order.strategy';
import { CacheService } from '../src/modules/cache/cache.service';
import {
  ProcessOrderJobData,
  ShipOrderJobData,
  DeliverOrderJobData,
} from '../src/modules/order/misc/order-job-data';
import { OrderJob } from '../src/modules/order/enums/order-job.enum';
import * as argon2 from 'argon2';

// Skip real delays inside strategies
jest.mock('../src/modules/common/helpers/helpers', () => ({
  delay: jest.fn().mockResolvedValue(undefined),
}));

describe('POST /orders → DELIVERED (e2e)', () => {
  let app: INestApplication;

  // Shared in-memory state
  let userStore: Record<string, any> = {};
  let orderStore: Record<string, any> = {};
  let orderItemStore: any[] = [];
  let cacheStore: Record<string, any> = {};
  let refreshTokenStore: Record<string, string> = {};
  let enqueuedJobs: Array<{ name: string; data: any }> = [];

  // ── Helper builders ────────────────────────────────────────────────────────

  function buildUserRepository() {
    return {
      create: jest.fn().mockImplementation((data) => ({ ...data })),
      save: jest.fn().mockImplementation(async (user) => {
        const id = 'user-e2e-' + Date.now();
        const record = { id, ...user };
        userStore[id] = record;
        return record;
      }),
      findOne: jest.fn().mockImplementation(async ({ where, select }) => {
        const entry = Object.values(userStore).find((u: any) => {
          if (where.email) return u.email === where.email;
          if (where.id) return u.id === where.id;
          return false;
        }) as any;
        if (!entry) return null;
        // Simulate TypeORM select option — always return password fields when asked
        return { ...entry };
      }),
      update: jest.fn().mockImplementation(async (id, partial) => {
        if (userStore[id]) Object.assign(userStore[id], partial);
      }),
    };
  }

  function buildOrderRepository() {
    return {
      create: jest.fn().mockImplementation((data) => ({ ...data })),
      save: jest.fn().mockImplementation(async (order) => {
        const id = order.id ?? 'order-e2e-' + Date.now();
        const record = { id, ...order };
        orderStore[id] = record;
        return record;
      }),
      findOne: jest.fn().mockImplementation(async ({ where, relations }) => {
        const entry = orderStore[where.id] ?? null;
        if (!entry) return null;
        if (relations?.includes('items')) {
          entry.items = orderItemStore.filter((i) => i.orderId === where.id);
        }
        if (relations?.includes('user')) {
          entry.user = userStore[entry.user?.id ?? entry.userId] ?? entry.user;
        }
        return { ...entry };
      }),
      update: jest.fn().mockImplementation(async (id, partial) => {
        if (orderStore[id]) Object.assign(orderStore[id], partial);
      }),
      remove: jest.fn().mockImplementation(async (order) => {
        delete orderStore[order.id];
        return order;
      }),
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      }),
    };
  }

  function buildOrderItemRepository() {
    return {
      create: jest.fn().mockImplementation((data) => ({ ...data })),
      save: jest.fn().mockImplementation(async (items: any[]) => {
        const saved = items.map((item) => ({
          id: 'item-' + Math.random(),
          ...item,
        }));
        orderItemStore.push(...saved);
        return saved;
      }),
      delete: jest.fn().mockImplementation(async ({ orderId }) => {
        orderItemStore = orderItemStore.filter((i) => i.orderId !== orderId);
      }),
    };
  }

  function buildCacheService() {
    return {
      get: jest.fn().mockImplementation(async (key: string) => cacheStore[key] ?? null),
      set: jest.fn().mockImplementation(async (key: string, value: any) => {
        cacheStore[key] = value;
      }),
      delete: jest.fn().mockImplementation(async (key: string) => {
        delete cacheStore[key];
      }),
      deletePattern: jest.fn().mockResolvedValue(undefined),
      setIfNotExists: jest.fn().mockImplementation(async (key: string, value: any) => {
        if (cacheStore[key]) return false;
        cacheStore[key] = value;
        return true;
      }),
    };
  }

  function buildOrderQueue() {
    return {
      add: jest.fn().mockImplementation(async (name: string, data: any) => {
        enqueuedJobs.push({ name, data });
      }),
    };
  }

  // ── App bootstrap ──────────────────────────────────────────────────────────

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getRepositoryToken(User))
      .useValue(buildUserRepository())
      .overrideProvider(getRepositoryToken(Order))
      .useValue(buildOrderRepository())
      .overrideProvider(getRepositoryToken(OrderItem))
      .useValue(buildOrderItemRepository())
      .overrideProvider(CacheService)
      .useValue(buildCacheService())
      .overrideProvider(getQueueToken('orders'))
      .useValue(buildOrderQueue())
      .overrideProvider(getQueueToken('events'))
      .useValue({ add: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication();

    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    userStore = {};
    orderStore = {};
    orderItemStore = [];
    cacheStore = {};
    refreshTokenStore = {};
    enqueuedJobs = [];
  });

  // ── The actual test ────────────────────────────────────────────────────────

  it('should create an order and transition it to DELIVERED', async () => {
    const logger = new Logger('E2E');

    // ── 1. Create user ───────────────────────────────────────────────────────

    const registerRes = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('idempotency-key', 'idem-user-e2e-1')
      .send({
        name: 'E2E User',
        email: 'e2e@example.com',
        password: 'Password1!',
      })
      .expect(201);

    const userId = registerRes.body.id;
    expect(userId).toBeDefined();

    // Ensure the user repository has a hashed password so login works
    const userRepo = app
      .get(getRepositoryToken(User)) as ReturnType<typeof buildUserRepository>;

    // Hash password as the service would have done (UserService.create calls AuthService.hashPasswordOrToken)
    const hash = await argon2.hash('Password1!', {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    });
    // Manually set the hashed password in our in-memory store so auth works
    const storedUser = Object.values(userStore)[0] as any;
    storedUser.password = hash;

    // ── 2. Login ─────────────────────────────────────────────────────────────

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'e2e@example.com', password: 'Password1!' })
      .expect(201);

    const { accessToken } = loginRes.body;
    expect(accessToken).toBeDefined();

    // ── 3. Create order ──────────────────────────────────────────────────────

    const createOrderRes = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('idempotency-key', 'idem-order-e2e-1')
      .send({
        items: [
          { productId: 'prod-1', quantity: 2, price: 49.99 },
          { productId: 'prod-2', quantity: 1, price: 99.99 },
        ],
      })
      .expect(201);

    const orderId = createOrderRes.body.id;
    expect(orderId).toBeDefined();
    expect(createOrderRes.body.status).toBe(OrderStatus.PENDING);

    // A PROCESS_ORDER job should have been enqueued
    expect(enqueuedJobs.some((j) => j.name === OrderJob.PROCESS_ORDER)).toBe(true);

    // ── 4. Drive the strategy chain ──────────────────────────────────────────

    const processStrategy = app.get<ProcessOrderStrategy>(ProcessOrderStrategy);
    const shipStrategy = app.get<ShipOrderStrategy>(ShipOrderStrategy);
    const deliverStrategy = app.get<DeliverOrderStrategy>(DeliverOrderStrategy);

    // Make sure cacheStore is clean for strategy idempotency checks
    // (idempotency keys are per-order, not per session)
    const processJob = enqueuedJobs.find((j) => j.name === OrderJob.PROCESS_ORDER)!;
    await processStrategy.execute(
      { data: processJob.data, id: 'j-process' } as any,
      logger,
    );

    const shipJob = enqueuedJobs.find((j) => j.name === OrderJob.SHIP_ORDER)!;
    expect(shipJob).toBeDefined();
    await shipStrategy.execute(
      { data: shipJob.data, id: 'j-ship' } as any,
      logger,
    );

    const deliverJob = enqueuedJobs.find((j) => j.name === OrderJob.DELIVER_ORDER)!;
    expect(deliverJob).toBeDefined();
    await deliverStrategy.execute(
      { data: deliverJob.data, id: 'j-deliver' } as any,
      logger,
    );

    // ── 5. Assert final order status ─────────────────────────────────────────

    const getOrderRes = await request(app.getHttpServer())
      .get(`/api/v1/orders/${orderId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(getOrderRes.body.id).toBe(orderId);
    expect(getOrderRes.body.status).toBe(OrderStatus.DELIVERED);
  });
});
