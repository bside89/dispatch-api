/*eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '@/app.module';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@/shared/constants/redis-client.constant';
import { UsersService } from '@/modules/users/users.service';
import { OrdersService } from '@/modules/orders/orders.service';
import { ItemsService } from '@/modules/items/items.service';
import { OutboxRepository } from '@/shared/modules/outbox/repositories/outbox.repository';
import { cleanDatabase, cleanRedis } from './utils/database-cleaner';
import { paymentsGatewayServiceMock } from './utils/mock-payments-gateway-service';
import { INestApplication } from '@nestjs/common';
import { Queue, Job } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';
import { waitFor } from './utils/wait-for';
import { EVENT_QUEUE_TOKEN } from '@/shared/constants/queue-tokens';
import { DeliverOrderJobStrategy } from '@/modules/orders/strategies/deliver-order-job.strategy';
import { ProcessOrderJobStrategy } from '@/modules/orders/strategies/process-order-job.strategy';
import { OrderProcessor } from '@/modules/orders/processors/order.processor';
import { PaymentsGatewayService } from '@/modules/payments-gateway/payments-gateway.service';

// Mock the delay function to resolve almost instantly.
// This eliminates the simulated processing delays (1s-3s) used by
// Job Strategies, making the pipeline tests much faster.
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
  let itemsService: ItemsService;
  let outboxRepository: OutboxRepository;
  let eventBusQueue: Queue;
  let dataSource: DataSource;
  let redisClient: Redis;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PaymentsGatewayService)
      .useValue(paymentsGatewayServiceMock)
      .compile();

    app = module.createNestApplication();
    await app.init();

    usersService = module.get<UsersService>(UsersService);
    ordersService = module.get<OrdersService>(OrdersService);
    itemsService = module.get<ItemsService>(ItemsService);
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

      // Arrange: create two items at different prices
      const itemA = await itemsService.create(
        {
          name: 'Product AAA',
          description: 'Integration test item A',
          quantity: 100,
          price: 5000,
        },
        'idempotency-key-create-order-test-itemA',
      );
      const itemB = await itemsService.create(
        {
          name: 'Product BBB',
          description: 'Integration test item B',
          quantity: 100,
          price: 3000,
        },
        'idempotency-key-create-order-test-itemB',
      );

      // Act: create an order via OrdersService using the real user ID
      const createOrderDto = {
        items: [
          { itemId: itemA.id, quantity: 2 },
          { itemId: itemB.id, quantity: 1 },
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
        `SELECT "itemId", quantity FROM order_items WHERE "orderId" = $1 ORDER BY "itemId"`,
        [orders[0].id],
      );
      expect(orderItems).toHaveLength(2);
      expect(orderItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ itemId: itemA.id, quantity: 2 }),
          expect.objectContaining({ itemId: itemB.id, quantity: 1 }),
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
      // Arrange: create the user directly in the database so this test stays
      // focused on the Order transaction and does not enqueue Stripe jobs.
      const [{ id: userId }] = await dataSource.query(
        `INSERT INTO "users" (name, email, password, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        ['Rollback User', 'rollback@test.com', 'securePass123', 'user'],
      );

      // Arrange: create an item directly in the DB (no outbox side effects)
      const [{ id: itemId }] = await dataSource.query(
        `INSERT INTO "items" (name, description, quantity, price)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        ['Rollback Item', 'Used for rollback test', 10, 7500],
      );

      // Force the OutboxRepository.save to throw an error, simulating a DB failure
      const saveSpy = jest
        .spyOn(outboxRepository, 'save')
        .mockRejectedValueOnce(new Error('Simulated Outbox insertion failure'));

      const createOrderDto = {
        items: [{ itemId, quantity: 1 }],
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

      // Assert: verify that no Order processing job was persisted in the Outbox.
      // User creation may enqueue payment jobs, so we only care about the Order flow here.
      const outboxEntries = await dataSource.query(
        `SELECT id FROM outbox WHERE type = 'ORDER_PROCESS'`,
      );
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

      // Arrange: create items so the order total is deterministic
      const itemX = await itemsService.create(
        {
          name: 'Product XXX',
          description: 'Pipeline test item X',
          quantity: 100,
          price: 4000,
        },
        'idempotency-key-full-flow-itemX',
      );
      const itemY = await itemsService.create(
        {
          name: 'Product YYY',
          description: 'Pipeline test item Y',
          quantity: 100,
          price: 6000,
        },
        'idempotency-key-full-flow-itemY',
      );

      // Act: create an order — returns with PENDING status
      const createOrderDto = {
        items: [
          { itemId: itemX.id, quantity: 3 },
          { itemId: itemY.id, quantity: 2 },
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
      // delay() is mocked and setImmediate triggers process() after each add(),
      // so each step resolves in ~10-50ms (BullMQ + Redis latency).
      await waitFor(
        async () => {
          const rows = await dataSource.query(
            `SELECT status FROM orders WHERE id = $1`,
            [orderId],
          );
          return rows.length === 1 && rows[0].status === 'DELIVERED';
        },
        15_000, // 15s timeout (3 steps × ~50ms + CI margin)
        250, // poll every 250ms
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
      // last EVENTS_NOTIFY_USER to the Outbox. setImmediate triggers process()
      // immediately after add(), so this resolves within milliseconds.
      await waitFor(
        async () => {
          const rows = await dataSource.query(`SELECT id FROM outbox`);
          return rows.length === 0;
        },
        5_000, // 5s — enough for one extra setImmediate cycle
        250,
      );

      // Assert: all notification events have been processed by the events queue.
      // The flow produces exactly 3 EVENTS_NOTIFY_USER outbox entries (one per
      // strategy: process, ship, deliver). Wait for all events to complete
      // processing in the events queue.
      await waitFor(
        async () => {
          const completedCount = await eventBusQueue.getCompletedCount();
          return completedCount >= 3;
        },
        10_000, // 10s buffer for event processing
        250,
      );

      const completedEvents = await eventBusQueue.getCompletedCount();
      expect(completedEvents).toBeGreaterThanOrEqual(3);
    }, 30_000); // Jest timeout: 30s (delay mocked + setImmediate replaces cron bottleneck)
  });

  describe('Order Compensation Flow', () => {
    it('should do the compensation logic and refund the Order when post-payment processing fails', async () => {
      // Arrange: get DeliverOrderJobStrategy to force all delivery attempts to fail.
      // This exhausts all BullMQ retries and triggers the executeAfterFail
      // compensation path, which enqueues ORDER_CANCEL → CancelOrderJobStrategy
      // updates order to CANCELLED and enqueues ORDER_REFUND →
      // RefundOrderJobStrategy updates to REFUNDED.
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

        // Arrange: create an item for the order
        const compItem = await itemsService.create(
          {
            name: 'Compensation Item',
            description: 'Item for compensation test',
            quantity: 100,
            price: 3000,
          },
          'idempotency-key-compensation-item',
        );

        // Act: create an order — returns with PENDING status
        const createOrderDto = {
          items: [{ itemId: compItem.id, quantity: 2 }],
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
        // delay() is mocked and setImmediate triggers process() after each add().
        await waitFor(
          async () => {
            const rows = await dataSource.query(
              `SELECT status FROM orders WHERE id = $1`,
              [orderId],
            );
            return rows.length === 1 && rows[0].status === 'REFUNDED';
          },
          30_000, // 30s (5 steps + 3 BullMQ retries × ~50ms + CI margin)
          250,
        );

        // Assert: final order status is REFUNDED
        const [finalOrder] = await dataSource.query(
          `SELECT status FROM orders WHERE id = $1`,
          [orderId],
        );
        expect(finalOrder.status).toBe('REFUNDED');

        // Assert: outbox should be fully consumed (RefundOrderJobStrategy adds one
        // final EVENTS_NOTIFY_USER entry; setImmediate dispatches it immediately)
        await waitFor(
          async () => {
            const rows = await dataSource.query(`SELECT id FROM outbox`);
            return rows.length === 0;
          },
          5_000,
          250,
        );
      } finally {
        deliverSpy.mockRestore();
      }
    }, 45_000);

    it('should do the compensation logic and cancel the Order when pre-payment processing fails', async () => {
      // Arrange: spy on the private processPayment method to always throw. Since
      // paid is never set to true, the compensation logic in executeAfterFail
      // enqueues ORDER_CANCEL instead of ORDER_REFUND. CancelOrderJobStrategy then
      // sets the order to CANCELLED and enqueues ORDER_REFUND, but
      // RefundOrderJobStrategy.getAndValidate rejects the transition because
      // REFUNDED preconditions are [PAID, SHIPPED, DELIVERED] — CANCELLED is not
      // included — so the order stays in CANCELLED.
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

        // Arrange: create an item for the order
        const failItem = await itemsService.create(
          {
            name: 'Payment Failure Item',
            description: 'Item for payment failure test',
            quantity: 100,
            price: 5000,
          },
          'idempotency-key-payment-failure-item',
        );

        // Act: create an order — returns with PENDING status
        const createOrderDto = {
          items: [{ itemId: failItem.id, quantity: 1 }],
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
        //                          → executeAfterFail → compensationLogic (order.paid=false)
        //   Outbox → ORDER_CANCEL  → order = CANCELLED
        //   Outbox → ORDER_REFUND  → getAndValidate fails (CANCELLED ∉ REFUNDED preconditions)
        //                          → no-op, order stays CANCELLED
        //
        // delay() is mocked and setImmediate triggers process() after each add().
        await waitFor(
          async () => {
            const rows = await dataSource.query(
              `SELECT status FROM orders WHERE id = $1`,
              [orderId],
            );
            return rows.length === 1 && rows[0].status === 'CANCELLED';
          },
          15_000, // 15s (3 steps + 3 BullMQ retries × ~50ms + CI margin)
          250,
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
          5_000,
          250,
        );
      } finally {
        paymentSpy.mockRestore();
      }
    }, 30_000);
  });

  describe('Concurrency and Locking', () => {
    it('should not execute the same Job twice simultaneously due to job-execute lock', async () => {
      const orderProcessor = app.get<OrderProcessor>(OrderProcessor);
      const processOrderJobStrategy = app.get<ProcessOrderJobStrategy>(
        ProcessOrderJobStrategy,
      );

      // We use a custom sleep since `delay` is mocked to resolve instantly
      const sleep = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));

      const executeSpy = jest
        .spyOn(processOrderJobStrategy, 'execute')
        .mockImplementation(async () => {
          await sleep(100); // Simulate processing time to hold the lock
        });

      const fakeJob = {
        id: 'concurrent-job-123',
        name: 'ORDER_PROCESS',
        data: {
          orderId: 'fake-order-id',
          userId: 'fake-user-id',
          userName: 'Test User',
        },
        opts: { attempts: 3 },
        attemptsMade: 0,
      } as Job<any>;

      try {
        // Execute the same job multiple times simultaneously
        await Promise.all([
          orderProcessor.process(fakeJob),
          orderProcessor.process(fakeJob),
          orderProcessor.process(fakeJob),
        ]);

        // The lock combined with idempotency should guarantee the strategy is
        // executed exactly once for the same job ID.
        expect(executeSpy).toHaveBeenCalledTimes(1);
      } finally {
        executeSpy.mockRestore();
      }
    });
  });
});
