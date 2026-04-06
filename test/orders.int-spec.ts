/*eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '@/app.module';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@/shared/constants/redis-client.constant';
import { UsersService } from '@/modules/users/users.service';
import { OrdersService } from '@/modules/orders/orders.service';
import { OutboxRepository } from '@/shared/modules/outbox/repositories/outbox.repository';
import { cleanDatabase, cleanRedis } from './utils/database-cleaner';
import { INestApplication } from '@nestjs/common';
import { Queue } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';
import { waitFor } from './utils/wait-for';
import { EVENT_QUEUE_TOKEN } from '@/shared/modules/events/constants/event-queue.token';
import { DeliverOrderJobStrategy } from '@/modules/orders/strategies/deliver-order-job.strategy';
import { ProcessOrderJobStrategy } from '@/modules/orders/strategies/process-order-job.strategy';

// Mock the delay function to resolve almost instantly.
// This eliminates the simulated processing delays (1s-3s) used by
// ProcessPaymentOrderStrategy, ShipOrderStrategy, DeliverOrderStrategy,
// and NotificationStrategy, making the pipeline tests much faster.
jest.mock('@/shared/helpers/functions', () => ({
  ...jest.requireActual('@/shared/helpers/functions'),
  delay: () => Promise.resolve(),
}));

// Override BullMQ backoff delay to 0 so retries happen immediately in tests,
// eliminating the exponential wait (2s, 4s, …) between job failure attempts.
jest.mock('@/config/bullmq.config', () => ({
  ...jest.requireActual('@/config/bullmq.config'),
  bullmqDefaultJobOptions: {
    attempts: 3,
    backoff: { type: 'fixed', delay: 0 },
    removeOnFail: { age: 24 * 3600 },
  },
}));

describe('Orders (Integration)', () => {
  let app: INestApplication;
  let usersService: UsersService;
  let ordersService: OrdersService;
  let outboxRepository: OutboxRepository;
  let eventBusQueue: Queue;
  let dataSource: DataSource;
  let redisClient: Redis;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    usersService = module.get<UsersService>(UsersService);
    ordersService = module.get<OrdersService>(OrdersService);
    outboxRepository = module.get<OutboxRepository>(OutboxRepository);
    eventBusQueue = module.get<Queue>(getQueueToken(EVENT_QUEUE_TOKEN));
    dataSource = module.get<DataSource>(DataSource);
    redisClient = module.get<Redis>(REDIS_CLIENT);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase(dataSource);
    await cleanRedis(redisClient);
  });

  describe('Order Creation Flow', () => {
    it('should create an Order with status PENDING and an Outbox entry when a valid User exists', async () => {
      // Arrange: create a real user via UsersService
      const createdUser = await usersService.create(
        {
          name: 'Integration User',
          email: 'integration@test.com',
          password: 'securePass123',
        },
        'idempotency-key-create-order-test',
      );
      const userId = createdUser.id;

      // Act: create an order via OrdersService using the real user ID
      const createOrderDto = {
        items: [
          { productId: 'product-aaa', quantity: 2, price: 5000 },
          { productId: 'product-bbb', quantity: 1, price: 3000 },
        ],
      };
      await ordersService.create(createOrderDto, userId, 'idempotency-key-order-1');

      // Assert: verify the state directly in the database
      const orders = await dataSource.query(
        `SELECT id, "userId", status, total FROM orders WHERE "userId" = $1`,
        [userId],
      );
      expect(orders).toHaveLength(1);
      expect(orders[0].status).toBe('PENDING');
      expect(orders[0].total).toBe(13000); // (2 * 5000) + (1 * 3000)

      const orderItems = await dataSource.query(
        `SELECT "productId", quantity, price FROM order_items WHERE "orderId" = $1 ORDER BY "productId"`,
        [orders[0].id],
      );
      expect(orderItems).toHaveLength(2);
      expect(orderItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            productId: 'product-aaa',
            quantity: 2,
            price: 5000,
          }),
          expect.objectContaining({
            productId: 'product-bbb',
            quantity: 1,
            price: 3000,
          }),
        ]),
      );

      const outboxEntries = await dataSource.query(
        `SELECT type, payload FROM outbox ORDER BY "createdAt" DESC LIMIT 1`,
      );
      expect(outboxEntries).toHaveLength(1);
      expect(outboxEntries[0].type).toBe('ORDER_PROCESS');
    });
  });

  describe('Transactional Atomicity', () => {
    it('should rollback the Order when Outbox insertion fails', async () => {
      // Arrange: create a real user
      const createdUser = await usersService.create(
        {
          name: 'Rollback User',
          email: 'rollback@test.com',
          password: 'securePass123',
        },
        'idempotency-key-rollback-test',
      );
      const userId = createdUser.id;

      // Force the OutboxRepository.save to throw an error, simulating a DB failure
      const saveSpy = jest
        .spyOn(outboxRepository, 'save')
        .mockRejectedValueOnce(new Error('Simulated Outbox insertion failure'));

      const createOrderDto = {
        items: [{ productId: 'product-ccc', quantity: 1, price: 7500 }],
      };

      // Act: attempt to create the order — should fail due to Outbox error
      await expect(
        ordersService.create(
          createOrderDto,
          userId,
          'idempotency-key-order-rollback',
        ),
      ).rejects.toThrow('Simulated Outbox insertion failure');

      // Assert: verify that the Order was NOT persisted (transaction rolled back)
      const orders = await dataSource.query(
        `SELECT id FROM orders WHERE "userId" = $1`,
        [userId],
      );
      expect(orders).toHaveLength(0);

      // Assert: verify that the Outbox has no entries either
      const outboxEntries = await dataSource.query(`SELECT id FROM outbox`);
      expect(outboxEntries).toHaveLength(0);

      // Cleanup the spy
      saveSpy.mockRestore();
    });
  });

  describe('Order Full Processing Flow', () => {
    it('should process an Order through the entire async pipeline until DELIVERED status', async () => {
      // Arrange: create a real user
      const createdUser = await usersService.create(
        {
          name: 'Pipeline User',
          email: 'pipeline@test.com',
          password: 'securePass123',
        },
        'idempotency-key-full-flow-user',
      );
      const userId = createdUser.id;

      // Act: create an order — returns with PENDING status
      const createOrderDto = {
        items: [
          { productId: 'product-xxx', quantity: 3, price: 4000 },
          { productId: 'product-yyy', quantity: 2, price: 6000 },
        ],
      };
      const createdOrder = await ordersService.create(
        createOrderDto,
        userId,
        'idempotency-key-full-flow-order',
      );

      // Assert: order is initially PENDING
      expect(createdOrder.status).toBe('PENDING');

      const orderId = createdOrder.id;

      // Wait for the full async pipeline to complete:
      //   Outbox → ORDER_PROCESS → PAID
      //   Outbox → ORDER_SHIP → SHIPPED
      //   Outbox → ORDER_DELIVER → DELIVERED
      //
      // Each strategy has simulated delays (1s-3s) and the Outbox cron
      // runs every 5 seconds, so this may take up to ~60 seconds.
      await waitFor(
        async () => {
          const rows = await dataSource.query(
            `SELECT status FROM orders WHERE id = $1`,
            [orderId],
          );
          return rows.length === 1 && rows[0].status === 'DELIVERED';
        },
        60_000, // 60s timeout (delay is mocked; bottleneck is Outbox cron ~5s × 3 cycles)
        500, // poll every 500ms
      );

      // Assert: final order status is DELIVERED
      const [finalOrder] = await dataSource.query(
        `SELECT id, "userId", status, total FROM orders WHERE id = $1`,
        [orderId],
      );
      expect(finalOrder.status).toBe('DELIVERED');
      expect(finalOrder.total).toBe(24000); // (3 * 4000) + (2 * 6000)

      // Assert: outbox should be fully consumed (no pending entries).
      // When the order reaches DELIVERED, the DeliverOrderStrategy adds one
      // last EVENTS_NOTIFY_USER to the Outbox. We need to wait for the next
      // Outbox cron cycle (~5s) to dispatch it before asserting emptiness.
      await waitFor(
        async () => {
          const rows = await dataSource.query(`SELECT id FROM outbox`);
          return rows.length === 0;
        },
        15_000, // 15s — enough for one more Outbox cron cycle
        500,
      );

      // Assert: all notification events have been processed by the events queue.
      // Expected notifications:
      //   1. ProcessPaymentOrderStrategy  → "order has been paid"
      //   2. ShipOrderStrategy     → "order has been shipped"
      //   3. DeliverOrderStrategy  → "order has been delivered"
      //   4. updateStatus (called by ProcessPaymentOrderStrategy via Outbox→EVENTS_NOTIFY_USER
      //      during the PAID status change) — note: this is the notification from
      //      the Outbox EVENTS_NOTIFY_USER added by the strategy, NOT from updateStatus.
      //
      // The flow produces exactly 3 EVENTS_NOTIFY_USER outbox entries
      // (one per strategy: process, ship, deliver).
      // Wait for all events to complete processing in the events queue.
      await waitFor(
        async () => {
          const completedCount = await eventBusQueue.getCompletedCount();
          return completedCount >= 3;
        },
        30_000, // 30s extra buffer for event processing
        500,
      );

      const completedEvents = await eventBusQueue.getCompletedCount();
      expect(completedEvents).toBeGreaterThanOrEqual(3);
    }, 120_000); // Jest timeout: 2 minutes (delay is mocked, only Outbox cron intervals remain)
  });

  describe('Order Compensation Flow', () => {
    it('should do the compensation logic and refund the Order when post-payment processing fails', async () => {
      // Arrange: get DeliverOrderJobStrategy to force all delivery attempts to fail.
      // This exhausts all BullMQ retries and triggers the executeAfterFail compensation
      // path, which enqueues ORDER_CANCEL → CancelOrderJobStrategy updates order to
      // CANCELLED and enqueues ORDER_REFUND → RefundOrderJobStrategy updates to REFUNDED.
      const deliverOrderJobStrategy = app.get<DeliverOrderJobStrategy>(
        DeliverOrderJobStrategy,
      );

      const deliverSpy = jest
        .spyOn(deliverOrderJobStrategy, 'execute')
        .mockRejectedValue(new Error('Simulated delivery failure'));

      try {
        // Arrange: create a real user
        const createdUser = await usersService.create(
          {
            name: 'Compensation User',
            email: 'compensation@test.com',
            password: 'securePass123',
          },
          'idempotency-key-compensation-user',
        );
        const userId = createdUser.id;

        // Act: create an order — returns with PENDING status
        const createOrderDto = {
          items: [{ productId: 'product-comp', quantity: 2, price: 3000 }],
        };
        const createdOrder = await ordersService.create(
          createOrderDto,
          userId,
          'idempotency-key-compensation-order',
        );

        expect(createdOrder.status).toBe('PENDING');
        const orderId = createdOrder.id;

        // Wait for the full compensation pipeline to complete:
        //   Outbox → ORDER_PROCESS → order = PAID
        //   Outbox → ORDER_SHIP   → order = SHIPPED
        //   Outbox → ORDER_DELIVER → fails 3 times (backoff mocked to 0ms)
        //                         → executeAfterFail → compensationLogic
        //   Outbox → ORDER_CANCEL → order = CANCELLED → Outbox → ORDER_REFUND
        //   Outbox → ORDER_REFUND → order = REFUNDED
        //
        // ~5 Outbox cron cycles (up to 5s each) ≈ 25s worst case
        await waitFor(
          async () => {
            const rows = await dataSource.query(
              `SELECT status FROM orders WHERE id = $1`,
              [orderId],
            );
            return rows.length === 1 && rows[0].status === 'REFUNDED';
          },
          90_000,
          500,
        );

        // Assert: final order status is REFUNDED
        const [finalOrder] = await dataSource.query(
          `SELECT status FROM orders WHERE id = $1`,
          [orderId],
        );
        expect(finalOrder.status).toBe('REFUNDED');

        // Assert: outbox should be fully consumed (RefundOrderJobStrategy adds one
        // final EVENTS_NOTIFY_USER entry; wait for the next Outbox cron to dispatch it)
        await waitFor(
          async () => {
            const rows = await dataSource.query(`SELECT id FROM outbox`);
            return rows.length === 0;
          },
          15_000,
          500,
        );
      } finally {
        deliverSpy.mockRestore();
      }
    }, 120_000);

    it('should do the compensation logic and cancel the Order when pre-payment processing fails', async () => {
      // Arrange: spy on the private processPayment method to always throw.
      // Since paid is never set to true, the compensation logic in executeAfterFail
      // enqueues ORDER_CANCEL instead of ORDER_REFUND.
      // CancelOrderJobStrategy then sets the order to CANCELLED and enqueues ORDER_REFUND,
      // but RefundOrderJobStrategy.getAndValidate rejects the transition because
      // REFUNDED preconditions are [PAID, SHIPPED, DELIVERED] — CANCELLED is not included —
      // so the order stays in CANCELLED.
      const processOrderJobStrategy = app.get<ProcessOrderJobStrategy>(
        ProcessOrderJobStrategy,
      );

      const paymentSpy = jest
        .spyOn(processOrderJobStrategy as any, 'processPayment')
        .mockRejectedValue(new Error('Simulated payment failure'));

      try {
        // Arrange: create a real user
        const createdUser = await usersService.create(
          {
            name: 'Payment Failure User',
            email: 'payment-failure@test.com',
            password: 'securePass123',
          },
          'idempotency-key-payment-failure-user',
        );
        const userId = createdUser.id;

        // Act: create an order — returns with PENDING status
        const createOrderDto = {
          items: [{ productId: 'product-fail', quantity: 1, price: 5000 }],
        };
        const createdOrder = await ordersService.create(
          createOrderDto,
          userId,
          'idempotency-key-payment-failure-order',
        );

        expect(createdOrder.status).toBe('PENDING');
        const orderId = createdOrder.id;

        // Wait for the compensation pipeline to complete:
        //   Outbox → ORDER_PROCESS → processPayment throws 3× (backoff mocked to 0ms)
        //                         → executeAfterFail → compensationLogic (order.paid=false)
        //   Outbox → ORDER_CANCEL → order = CANCELLED
        //   Outbox → ORDER_REFUND → getAndValidate fails (CANCELLED ∉ REFUNDED preconditions)
        //                        → no-op, order stays CANCELLED
        //
        // ~3 Outbox cron cycles (up to 5s each) ≈ 15s worst case
        await waitFor(
          async () => {
            const rows = await dataSource.query(
              `SELECT status FROM orders WHERE id = $1`,
              [orderId],
            );
            return rows.length === 1 && rows[0].status === 'CANCELLED';
          },
          60_000,
          500,
        );

        // Assert: final order status is CANCELLED
        const [finalOrder] = await dataSource.query(
          `SELECT status FROM orders WHERE id = $1`,
          [orderId],
        );
        expect(finalOrder.status).toBe('CANCELLED');

        // Assert: outbox should be fully consumed
        await waitFor(
          async () => {
            const rows = await dataSource.query(`SELECT id FROM outbox`);
            return rows.length === 0;
          },
          15_000,
          500,
        );
      } finally {
        paymentSpy.mockRestore();
      }
    }, 120_000);
  });
});
