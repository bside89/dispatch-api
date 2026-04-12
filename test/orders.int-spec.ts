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
    it('should create an Order with status PENDING and no Outbox entries', async () => {
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
          stock: 1000,
          price: 5000,
        },
        'idempotency-key-create-order-test-itemA',
      );
      const itemB = await itemsService.create(
        {
          name: 'Product BBB',
          description: 'Integration test item B',
          stock: 1000,
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

      // Assert: no ORDER_PROCESS in outbox — the processing pipeline only
      // starts after the payment webhook fires (markPaymentAsSucceeded).
      const outboxEntries = await dataSource.query(
        `SELECT id FROM outbox WHERE type = 'ORDER_PROCESS'`,
      );
      expect(outboxEntries).toHaveLength(0);
    });
  });

  describe('Transactional Atomicity', () => {
    it('should rollback the Order status update when Outbox insertion fails in markPaymentAsSucceeded', async () => {
      // Arrange: raw-insert user and item to avoid triggering Stripe customer
      // outbox entries that would interfere with the mockRejectedValueOnce spy.
      const [{ id: userId }] = await dataSource.query(
        `INSERT INTO "users" (name, email, password, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        ['Rollback User', 'rollback@test.com', 'securePass123', 'user'],
      );

      const [{ id: itemId }] = await dataSource.query(
        `INSERT INTO "items" (name, description, stock, price)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        ['Rollback Item', 'Used for rollback test', 10, 7500],
      );

      // Act: create the order (create() does not touch the outbox, so the spy
      // is not triggered here — paymentIntentsCreate is handled by the mock).
      const createOrderDto = { items: [{ itemId, quantity: 1 }] };
      const createdOrder = await ordersService.create(
        createOrderDto,
        userId,
        'idempotency-key-order-rollback',
      );
      const orderId = createdOrder.id;

      // Force OutboxRepository.save to throw on the next call, simulating a DB
      // failure that occurs inside the markPaymentAsSucceeded transaction.
      const saveSpy = jest
        .spyOn(outboxRepository, 'save')
        .mockRejectedValueOnce(new Error('Simulated Outbox insertion failure'));

      // Act: simulate the Stripe webhook callback — should fail due to Outbox error
      await expect(
        ordersService.markPaymentAsSucceeded(orderId, 'pi_test', 'succeeded'),
      ).rejects.toThrow('Simulated Outbox insertion failure');

      // Assert: the status update (PENDING → PAID) was rolled back
      const [order] = await dataSource.query(
        `SELECT status FROM orders WHERE id = $1`,
        [orderId],
      );
      expect(order.status).toBe('PENDING');

      // Assert: no ORDER_PROCESS entry was persisted in the Outbox
      const outboxEntries = await dataSource.query(
        `SELECT id FROM outbox WHERE type = 'ORDER_PROCESS'`,
      );
      expect(outboxEntries).toHaveLength(0);

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
          stock: 1000,
          price: 4000,
        },
        'idempotency-key-full-flow-itemX',
      );
      const itemY = await itemsService.create(
        {
          name: 'Product YYY',
          description: 'Pipeline test item Y',
          stock: 1000,
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

      // Simulate the Stripe payment success webhook — sets PAID and enqueues ORDER_PROCESS.
      await ordersService.markPaymentAsSucceeded(
        orderId,
        'pi_test_full_flow',
        'succeeded',
      );

      // Wait for the full async pipeline to complete:
      //   webhook → markPaymentAsSucceeded → PAID + Outbox → ORDER_PROCESS
      //   Outbox → ORDER_PROCESS → PROCESSED + Outbox → ORDER_SHIP
      //   Outbox → ORDER_SHIP   → SHIPPED   + Outbox → ORDER_DELIVER
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
            stock: 1000,
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

        // Simulate the Stripe payment success webhook.
        await ordersService.markPaymentAsSucceeded(
          orderId,
          'pi_comp_delivery_fail',
          'succeeded',
        );

        // Wait for the full compensation pipeline to complete:
        //   webhook → markPaymentAsSucceeded → PAID + Outbox → ORDER_PROCESS
        //   Outbox → ORDER_PROCESS → PROCESSED + Outbox → ORDER_SHIP
        //   Outbox → ORDER_SHIP   → SHIPPED   + Outbox → ORDER_DELIVER
        //   Outbox → ORDER_DELIVER → fails 3 times (backoff mocked to 0ms)
        //                         → executeAfterFail → compensationLogic
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

    it('should cancel the Order when the payment webhook reports a failure', async () => {
      // Arrange: when Stripe fires payment_intent.payment_failed, PaymentsService
      // calls ordersService.markPaymentAsFailed(), which enqueues ORDER_CANCEL.
      // CancelOrderJobStrategy then restores stock and sets the order to CANCELLED.
      // The order never enters the processing pipeline.

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
          stock: 1000,
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

      // Act: simulate the Stripe payment failure webhook.
      // This enqueues ORDER_CANCEL (without touching the order status directly).
      await ordersService.markPaymentAsFailed(
        orderId,
        'pi_test_failed',
        'payment_failed',
      );

      // Wait for the cancellation pipeline to complete:
      //   webhook → markPaymentAsFailed → Outbox → ORDER_CANCEL
      //   Outbox → ORDER_CANCEL → restores stock + order = CANCELLED
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
        15_000, // 15s (ORDER_CANCEL step + CI margin)
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
