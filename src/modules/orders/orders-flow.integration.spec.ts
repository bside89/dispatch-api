/**
 * Integration test: complete order lifecycle
 *
 * Verifies the strategy chain PENDING → PROCESSED → SHIPPED → DELIVERED
 * without involving real external infrastructure (DB / Redis / BullMQ broker).
 * Each strategy is instantiated via the NestJS DI container with shared mocks
 * so that the in-memory "state" (repository + cache) is consistent across the
 * whole flow.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ProcessOrderStrategy } from './strategies/process-order.strategy';
import { ShipOrderStrategy } from './strategies/ship-order.strategy';
import { DeliverOrderStrategy } from './strategies/deliver-order.strategy';
import { CancelOrderStrategy } from './strategies/cancel-order.strategy';
import { CacheService } from '../cache/cache.service';
import { EVENT_BUS } from '../../shared/modules/events/constants/event-bus.token';
import { Order } from './entities/order.entity';
import { OrderStatus } from './enums/order-status.enum';
import {
  ProcessOrderJobPayload,
  ShipOrderJobPayload,
  DeliverOrderJobPayload,
  CancelOrderJobPayload,
} from './processors/payloads/order-job.payload';
import { OutboxType } from '@/shared/modules/outbox/enums/outbox-type.enum';

// Skip real delays so the suite runs fast
jest.mock('../../shared/helpers/functions', () => ({
  delay: jest.fn().mockResolvedValue(undefined),
}));

describe('Order flow integration (PENDING → DELIVERED)', () => {
  let processStrategy: ProcessOrderStrategy;
  let shipStrategy: ShipOrderStrategy;
  let deliverStrategy: DeliverOrderStrategy;
  let cancelStrategy: CancelOrderStrategy;

  // In-memory order store that all strategies share via the mocked repository
  let orderStore: Record<string, { id: string; status: OrderStatus }>;

  // Jobs enqueued by the strategies — we consume these to drive the next step
  let enqueuedJobs: Array<{ name: string; data: any }>;

  // Idempotency keys set by the strategies
  let cacheStore: Record<string, string>;

  let eventBus: { publish: jest.Mock };
  const logger = new Logger('IntegrationTest');

  const makeJob = <T>(data: T): Job<T> =>
    ({ data, id: 'job-integration' }) as any;

  beforeEach(async () => {
    orderStore = {};
    enqueuedJobs = [];
    cacheStore = {};

    // Repository mock: reflects state in orderStore
    const orderRepository = {
      findOne: jest
        .fn()
        .mockImplementation(({ where: { id } }) =>
          Promise.resolve(orderStore[id] ?? null),
        ),
      update: jest.fn().mockImplementation((id, partial) => {
        if (orderStore[id]) {
          Object.assign(orderStore[id], partial);
        }
        return Promise.resolve();
      }),
    };

    // Queue mock: captures enqueued jobs
    const orderQueue = {
      add: jest.fn().mockImplementation((name, data) => {
        enqueuedJobs.push({ name, data });
        return Promise.resolve();
      }),
    };

    // CacheService mock: uses cacheStore for idempotency
    const cacheServiceMock = {
      get: jest
        .fn()
        .mockImplementation((key: string) =>
          Promise.resolve(cacheStore[key] ?? null),
        ),
      set: jest.fn().mockImplementation((key: string, value: string) => {
        cacheStore[key] = value;
        return Promise.resolve();
      }),
      delete: jest.fn().mockImplementation((key: string) => {
        delete cacheStore[key];
        return Promise.resolve();
      }),
    };

    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessOrderStrategy,
        ShipOrderStrategy,
        DeliverOrderStrategy,
        CancelOrderStrategy,
        { provide: getQueueToken('orders'), useValue: orderQueue },
        { provide: getRepositoryToken(Order), useValue: orderRepository },
        { provide: EVENT_BUS, useValue: eventBus },
        { provide: CacheService, useValue: cacheServiceMock },
      ],
    }).compile();

    processStrategy = module.get<ProcessOrderStrategy>(ProcessOrderStrategy);
    shipStrategy = module.get<ShipOrderStrategy>(ShipOrderStrategy);
    deliverStrategy = module.get<DeliverOrderStrategy>(DeliverOrderStrategy);
    cancelStrategy = module.get<CancelOrderStrategy>(CancelOrderStrategy);
  });

  afterEach(() => jest.clearAllMocks());

  it('should transition order from PENDING → PROCESSED → SHIPPED → DELIVERED', async () => {
    const orderId = 'order-flow-1';
    const userId = 'user-flow-1';
    const userName = 'John Doe';
    const total = 100;

    // Seed the order in PENDING state
    orderStore[orderId] = { id: orderId, status: OrderStatus.PENDING };

    // ── Step 1: PROCESS ──────────────────────────────────────────────────────
    const processData = new ProcessOrderJobPayload(
      userId,
      orderId,
      total,
      userName,
    );
    await processStrategy.execute(makeJob(processData), logger);

    expect(orderStore[orderId].status).toBe(OrderStatus.PROCESSED);
    expect(enqueuedJobs).toHaveLength(1);
    expect(enqueuedJobs[0].name).toBe(OutboxType.ORDER_SHIP);

    // ── Step 2: SHIP ─────────────────────────────────────────────────────────
    const shipData = enqueuedJobs[0].data as ShipOrderJobPayload;
    await shipStrategy.execute(makeJob(shipData), logger);

    expect(orderStore[orderId].status).toBe(OrderStatus.SHIPPED);
    expect(enqueuedJobs).toHaveLength(2);
    expect(enqueuedJobs[1].name).toBe(OutboxType.ORDER_DELIVER);

    // ── Step 3: DELIVER ──────────────────────────────────────────────────────
    const deliverData = enqueuedJobs[1].data as DeliverOrderJobPayload;
    await deliverStrategy.execute(makeJob(deliverData), logger);

    expect(orderStore[orderId].status).toBe(OrderStatus.DELIVERED);
    // Delivery is the final step — no further jobs queued
    expect(enqueuedJobs).toHaveLength(2);

    // Three notifications were published: processed, shipped, delivered
    expect(eventBus.publish).toHaveBeenCalledTimes(3);
  });

  it('should transition order to CANCELLED and skip further processing', async () => {
    const orderId = 'order-flow-cancel';
    const userId = 'user-flow-cancel';

    orderStore[orderId] = { id: orderId, status: OrderStatus.PENDING };

    const cancelData = new CancelOrderJobPayload(userId, orderId, 'John Doe');
    await cancelStrategy.execute(makeJob(cancelData), logger);

    expect(orderStore[orderId].status).toBe(OrderStatus.CANCELLED);
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    // No shipping or delivery jobs queued
    expect(enqueuedJobs).toHaveLength(0);
  });

  it('should be idempotent across the entire flow — replaying jobs must be no-ops', async () => {
    const orderId = 'order-flow-idem';
    const userId = 'user-flow-idem';

    orderStore[orderId] = { id: orderId, status: OrderStatus.PENDING };

    const processData = new ProcessOrderJobPayload(
      userId,
      orderId,
      200,
      'John Doe',
    );
    const job = makeJob(processData);

    // Execute twice — second call must be a no-op
    await processStrategy.execute(job, logger);
    await processStrategy.execute(job, logger);

    // Repository updated only once
    const updateMock = (processStrategy as any).orderRepository
      .update as jest.Mock;
    expect(updateMock).toHaveBeenCalledTimes(1);
    // Only one SHIP_ORDER job enqueued
    expect(
      enqueuedJobs.filter((j) => j.name === OutboxType.ORDER_SHIP),
    ).toHaveLength(1);
  });

  it('should publish one notification per strategy step', async () => {
    const orderId = 'order-notif-check';
    const userId = 'user-notif-check';

    orderStore[orderId] = { id: orderId, status: OrderStatus.PENDING };

    await processStrategy.execute(
      makeJob(new ProcessOrderJobPayload(userId, orderId, 50, 'John Doe')),
      logger,
    );
    await shipStrategy.execute(
      makeJob(new ShipOrderJobPayload(userId, orderId, 'John Doe')),
      logger,
    );
    await deliverStrategy.execute(
      makeJob(new DeliverOrderJobPayload(userId, orderId, 'John Doe')),
      logger,
    );

    const publishedUserIds = eventBus.publish.mock.calls.map(
      ([payload]) => payload.userId,
    );
    expect(publishedUserIds).toHaveLength(3);
    // All notifications target the correct user
    publishedUserIds.forEach((id) => expect(id).toBe(userId));
  });
});
