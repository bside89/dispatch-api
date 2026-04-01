import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '@/app.module';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { UsersService } from '@/modules/users/users.service';
import { OrdersService } from '@/modules/orders/orders.service';
import { OutboxRepository } from '@/shared/modules/outbox/repositories/outbox.repository';
import { cleanDatabase, cleanRedis } from './utils/database-cleaner';
import { INestApplication } from '@nestjs/common';
import { Queue } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';
import { waitFor } from './utils/wait-for';

// Mock the delay function to resolve almost instantly.
// This eliminates the simulated processing delays (1s-3s) used by
// ProcessOrderStrategy, ShipOrderStrategy, DeliverOrderStrategy,
// and NotificationStrategy, making the pipeline tests much faster.
jest.mock('@/shared/helpers/functions', () => ({
  delay: () => Promise.resolve(),
}));

describe('App (Integration)', () => {
  let app: INestApplication;
  let usersService: UsersService;
  let ordersService: OrdersService;
  let outboxRepository: OutboxRepository;
  let orderQueue: Queue;
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
    orderQueue = module.get<Queue>(getQueueToken('orders'));
    eventBusQueue = module.get<Queue>(getQueueToken('events'));
    dataSource = module.get<DataSource>(DataSource);
    redisClient = module.get<Redis>('REDIS_CLIENT');
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
      await ordersService.create(
        createOrderDto,
        userId,
        'idempotency-key-order-1',
      );

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
      //   Outbox → ORDER_PROCESS → PROCESSED
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
      //   1. ProcessOrderStrategy  → "order has been processed"
      //   2. ShipOrderStrategy     → "order has been shipped"
      //   3. DeliverOrderStrategy  → "order has been delivered"
      //   4. updateStatus (called by ProcessOrderStrategy via Outbox→EVENTS_NOTIFY_USER
      //      during the PROCESSED status change) — note: this is the notification from
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
});
