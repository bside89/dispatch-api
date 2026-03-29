/**
 * E2E test: POST /orders → DELIVERED
 *
 * Bootstraps the full NestJS application with mocked DB / Redis / BullMQ
 * so it can run in CI without external services.
 *
 * Flow:
 *   1. POST /v1/users  → create a test user
 *   2. POST /v1/auth/login → obtain JWT access token
 *   3. POST /v1/orders → create an order (status: PENDING, PROCESS_ORDER job enqueued)
 *   4. Drive the strategy chain manually: PROCESS → SHIP → DELIVER
 *   5. GET  /v1/orders/:id → assert final status is DELIVERED
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import { AppModule } from '../src/app.module';
import { Order } from '../src/modules/orders/entities/order.entity';
import { User } from '../src/modules/users/entities/user.entity';
import { OrderStatus } from '../src/modules/orders/enums/order-status.enum';
import { ProcessOrderStrategy } from '../src/modules/orders/strategies/process-order.strategy';
import { ShipOrderStrategy } from '../src/modules/orders/strategies/ship-order.strategy';
import { DeliverOrderStrategy } from '../src/modules/orders/strategies/deliver-order.strategy';
import { CacheService } from '../src/modules/cache/cache.service';
import { OrderJob } from '../src/modules/orders/enums/order-job.enum';
import { UserRepository } from '../src/modules/users/repositories/user.repository';
import { OrderRepository } from '../src/modules/orders/repositories/order.repository';
import { OrderItemRepository } from '../src/modules/orders/repositories/order-item.repository';
import * as argon2 from 'argon2';

// Skip real delays inside strategies
jest.mock('../src/shared/helpers/functions', () => ({
  delay: jest.fn().mockResolvedValue(undefined),
}));

// Prevent BullMQ Workers from requiring a live Redis connection during tests
jest.mock('bullmq', () => {
  const actual = jest.requireActual('bullmq');
  return {
    ...actual,
    Worker: jest.fn().mockImplementation(() => ({
      on: jest.fn().mockReturnThis(),
      close: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

// Prevent BullBoardModule from rejecting non-Queue objects during onModuleInit
jest.mock('@bull-board/api/bullMQAdapter', () => ({
  BullMQAdapter: jest.fn().mockImplementation(() => ({
    getName: jest.fn().mockReturnValue('mock'),
    getQueues: jest.fn().mockReturnValue([]),
    setQueues: jest.fn(),
    getQueue: jest.fn(),
    toJSON: jest.fn().mockReturnValue({}),
  })),
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
      findOneWhere: jest.fn().mockImplementation(async (params: any) => {
        const entry = Object.values(userStore).find((u: any) => {
          if (params.email) return u.email === params.email;
          if (params.id) return u.id === params.id;
          return false;
        }) as any;
        return entry ? { ...entry } : null;
      }),
      createEntity: jest.fn().mockImplementation((data: any) => ({ ...data })),
      save: jest.fn().mockImplementation(async (user: any) => {
        const id = user.id ?? 'user-e2e-' + Date.now();
        const record = { id, ...user };
        userStore[id] = record;
        return record;
      }),
      findById: jest.fn().mockImplementation(async (id: string) => {
        return userStore[id] ? { ...userStore[id] } : null;
      }),
      findAllWithFilters: jest.fn().mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      }),
      update: jest.fn().mockImplementation(async (id: string, partial: any) => {
        if (userStore[id]) Object.assign(userStore[id], partial);
      }),
    };
  }

  function buildOrderTypeOrmMock() {
    return {
      findOne: jest.fn().mockImplementation(async ({ where }: any) => {
        const entry = orderStore[where.id] ?? null;
        return entry ? { ...entry } : null;
      }),
      save: jest.fn().mockImplementation(async (order: any) => {
        const id = order.id ?? require('crypto').randomUUID();
        const record = { id, ...order };
        orderStore[id] = record;
        return record;
      }),
      update: jest.fn().mockImplementation(async (id: string, partial: any) => {
        if (orderStore[id]) Object.assign(orderStore[id], partial);
      }),
      create: jest.fn().mockImplementation((data: any) => ({ ...data })),
    };
  }

  function buildOrderRepository() {
    return {
      createEntity: jest.fn().mockImplementation((data: any) => ({ ...data })),
      save: jest.fn().mockImplementation(async (order: any) => {
        const id = order.id ?? require('crypto').randomUUID();
        const record = { id, ...order };
        orderStore[id] = record;
        return record;
      }),
      findOneWithRelations: jest
        .fn()
        .mockImplementation(async (params: any, relations?: string[]) => {
          const entry = orderStore[params.id] ?? null;
          if (!entry) return null;
          const result = { ...entry };
          if (relations?.includes('items')) {
            result.items = orderItemStore.filter(
              (i: any) => i.orderId === params.id,
            );
          }
          if (relations?.includes('user')) {
            result.user =
              userStore[entry.user?.id ?? entry.userId] ?? entry.user;
          }
          return result;
        }),
      findById: jest.fn().mockImplementation(async (id: string) => {
        return orderStore[id] ? { ...orderStore[id] } : null;
      }),
      findAllWithFilters: jest.fn().mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      }),
      update: jest.fn().mockImplementation(async (id: string, partial: any) => {
        if (orderStore[id]) Object.assign(orderStore[id], partial);
      }),
    };
  }

  function buildOrderItemRepository() {
    return {
      createEntity: jest.fn().mockImplementation((data: any) => ({ ...data })),
      saveMany: jest.fn().mockImplementation(async (items: any[]) => {
        const saved = items.map((item) => ({
          id: 'item-' + Math.random(),
          ...item,
        }));
        orderItemStore.push(...saved);
        return saved;
      }),
    };
  }

  function buildCacheService() {
    return {
      get: jest
        .fn()
        .mockImplementation(async (key: string) => cacheStore[key] ?? null),
      set: jest.fn().mockImplementation(async (key: string, value: any) => {
        cacheStore[key] = value;
      }),
      delete: jest.fn().mockImplementation(async (key: string) => {
        delete cacheStore[key];
      }),
      deletePattern: jest.fn().mockResolvedValue(undefined),
      setIfNotExists: jest
        .fn()
        .mockImplementation(async (key: string, value: any) => {
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
      .overrideProvider(getRepositoryToken(Order))
      .useValue(buildOrderTypeOrmMock())
      .overrideProvider(UserRepository)
      .useValue(buildUserRepository())
      .overrideProvider(OrderRepository)
      .useValue(buildOrderRepository())
      .overrideProvider(OrderItemRepository)
      .useValue(buildOrderItemRepository())
      .overrideProvider(CacheService)
      .useValue(buildCacheService())
      .overrideProvider(getQueueToken('orders'))
      .useValue(buildOrderQueue())
      .overrideProvider(getQueueToken('events'))
      .useValue({ add: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication();

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
      .post('/v1/users')
      .set('idempotency-key', 'idem-user-e2e-1')
      .send({
        name: 'E2E User',
        email: 'e2e@example.com',
        password: 'Password1!',
      })
      .expect(201);

    const userId = registerRes.body.data.id;
    expect(userId).toBeDefined();

    // Hash password as the service would have done (UserService.create calls HashUtils.hash)
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
      .post('/v1/auth/login')
      .send({ email: 'e2e@example.com', password: 'Password1!' })
      .expect(201);

    const { accessToken } = loginRes.body;
    expect(accessToken).toBeDefined();

    // ── 3. Create order ──────────────────────────────────────────────────────

    const createOrderRes = await request(app.getHttpServer())
      .post('/v1/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('idempotency-key', 'idem-order-e2e-1')
      .send({
        items: [
          { productId: 'prod-1', quantity: 2, price: 4999 },
          { productId: 'prod-2', quantity: 1, price: 9999 },
        ],
      })
      .expect(201);

    const orderId = createOrderRes.body.data.id;
    expect(orderId).toBeDefined();
    expect(createOrderRes.body.data.status).toBe(OrderStatus.PENDING);

    // A PROCESS_ORDER job should have been enqueued
    expect(enqueuedJobs.some((j) => j.name === OrderJob.PROCESS_ORDER)).toBe(
      true,
    );

    // ── 4. Drive the strategy chain ──────────────────────────────────────────

    const processStrategy = app.get<ProcessOrderStrategy>(ProcessOrderStrategy);
    const shipStrategy = app.get<ShipOrderStrategy>(ShipOrderStrategy);
    const deliverStrategy = app.get<DeliverOrderStrategy>(DeliverOrderStrategy);

    // Make sure cacheStore is clean for strategy idempotency checks
    // (idempotency keys are per-order, not per session)
    const processJob = enqueuedJobs.find(
      (j) => j.name === OrderJob.PROCESS_ORDER,
    )!;
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

    const deliverJob = enqueuedJobs.find(
      (j) => j.name === OrderJob.DELIVER_ORDER,
    )!;
    expect(deliverJob).toBeDefined();
    await deliverStrategy.execute(
      { data: deliverJob.data, id: 'j-deliver' } as any,
      logger,
    );

    // ── 5. Assert final order status ─────────────────────────────────────────

    const getOrderRes = await request(app.getHttpServer())
      .get(`/v1/orders/${orderId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(getOrderRes.body.data.id).toBe(orderId);
    expect(getOrderRes.body.data.status).toBe(OrderStatus.DELIVERED);
  });
});
