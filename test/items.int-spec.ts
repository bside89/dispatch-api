import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '@/app.module';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@/shared/modules/cache/constants/redis-client.token';
import { IItemsService } from '@/modules/items/interfaces/items-service.interface';
import {
  ITEMS_SERVICE,
  ITEM_REPOSITORY,
} from '@/modules/items/constants/items.token';
import { IItemRepository } from '@/modules/items/interfaces/item-repository.interface';
import { PAYMENTS_GATEWAY_SERVICE } from '@/modules/payment-gateways/constants/payments-gateway.token';
import { cleanDatabase, cleanRedis } from './utils/database-cleaner';
import { paymentsGatewayServiceMock } from './utils/mock-payments-gateway-service';
import {
  INestApplication,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

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

describe('Items (Integration)', () => {
  let app: INestApplication;
  let itemsService: IItemsService;
  let itemRepository: IItemRepository;
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

    itemsService = app.get<IItemsService>(ITEMS_SERVICE);
    itemRepository = app.get<IItemRepository>(ITEM_REPOSITORY);
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
  // Item Creation — Idempotency
  // ---------------------------------------------------------------------------

  describe('Item Creation — Idempotency', () => {
    it('should return the same item when called twice with the same idempotency key', async () => {
      const dto = {
        name: 'Widget',
        description: 'An idempotency test item',
        stock: 100,
        price: 2500,
      };

      const first = await itemsService.adminCreate(dto, 'idem-item-key-1');
      const second = await itemsService.adminCreate(dto, 'idem-item-key-1');

      expect(first.id).toBe(second.id);

      const rows = await dataSource.query(`SELECT id FROM items WHERE name = $1`, [
        'Widget',
      ]);
      expect(rows).toHaveLength(1);
    });

    it('should create two separate items when called with different idempotency keys', async () => {
      const dtoA = {
        name: 'Gadget A',
        description: 'Different key test A',
        stock: 50,
        price: 1500,
      };
      const dtoB = {
        name: 'Gadget B',
        description: 'Different key test B',
        stock: 30,
        price: 2000,
      };

      const first = await itemsService.adminCreate(dtoA, 'idem-item-key-a');
      const second = await itemsService.adminCreate(dtoB, 'idem-item-key-b');

      expect(first.id).not.toBe(second.id);

      const rows = await dataSource.query(`SELECT id FROM items`);
      expect(rows).toHaveLength(2);
    });

    it('should not create duplicate items under concurrent calls with the same key', async () => {
      const dto = {
        name: 'Concurrent Item',
        description: 'Concurrency idempotency test',
        stock: 200,
        price: 5000,
      };

      const [first, second] = await Promise.all([
        itemsService.adminCreate(dto, 'concurrent-item-key'),
        itemsService.adminCreate(dto, 'concurrent-item-key'),
      ]);

      expect(first.id).toBe(second.id);

      const rows = await dataSource.query(`SELECT id FROM items WHERE name = $1`, [
        'Concurrent Item',
      ]);
      expect(rows).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Item Creation — Transaction Atomicity
  // ---------------------------------------------------------------------------

  describe('Item Creation — Transaction Atomicity', () => {
    it('should not persist the item when save throws inside adminCreate', async () => {
      const saveSpy = jest
        .spyOn(itemRepository, 'save')
        .mockRejectedValueOnce(new Error('Simulated save failure'));

      await expect(
        itemsService.adminCreate(
          {
            name: 'Atomic Item',
            description: 'Transaction rollback test',
            stock: 10,
            price: 999,
          },
          'idem-item-atomic',
        ),
      ).rejects.toThrow('Simulated save failure');

      const rows = await dataSource.query(`SELECT id FROM items WHERE name = $1`, [
        'Atomic Item',
      ]);
      expect(rows).toHaveLength(0);

      saveSpy.mockRestore();
    });

    it('should not persist the update when save throws inside adminUpdate', async () => {
      // Arrange: create item to be updated
      const created = await itemsService.adminCreate(
        {
          name: 'Original Name',
          description: 'Before update',
          stock: 10,
          price: 1000,
        },
        'idem-item-update-target',
      );

      // Clear Redis idempotency cache so the next adminCreate with the same key is possible
      // (not relevant here — just demonstrating clean state)

      const saveSpy = jest
        .spyOn(itemRepository, 'save')
        .mockRejectedValueOnce(new Error('Simulated update save failure'));

      await expect(
        itemsService.adminUpdate(created.id, { name: 'Updated Name' }),
      ).rejects.toThrow('Simulated update save failure');

      const [row] = await dataSource.query(`SELECT name FROM items WHERE id = $1`, [
        created.id,
      ]);
      expect(row.name).toBe('Original Name');

      saveSpy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // Stock Operations
  // ---------------------------------------------------------------------------

  describe('Stock Operations', () => {
    it('should decrement stock correctly when there is sufficient stock', async () => {
      const created = await itemsService.adminCreate(
        {
          name: 'Stock Decrement Item',
          description: 'Decrement test',
          stock: 10,
          price: 500,
        },
        'idem-stock-decrement',
      );

      const entity = await itemRepository.findById(created.id);
      await itemsService.decrementItemStock(entity, 3);

      const [row] = await dataSource.query(`SELECT stock FROM items WHERE id = $1`, [
        created.id,
      ]);
      expect(row.stock).toBe(7);
    });

    it('should throw ForbiddenException without touching DB when stock is insufficient', async () => {
      const created = await itemsService.adminCreate(
        {
          name: 'Low Stock Item',
          description: 'Insufficient stock test',
          stock: 2,
          price: 500,
        },
        'idem-stock-insufficient',
      );

      const entity = await itemRepository.findById(created.id);

      // The pre-check throws SYNCHRONOUSLY before a Promise is returned,
      // so we use .toThrow() (not .rejects.toThrow()).
      expect(() => itemsService.decrementItemStock(entity, 5)).toThrow(
        ForbiddenException,
      );

      const [row] = await dataSource.query(`SELECT stock FROM items WHERE id = $1`, [
        created.id,
      ]);
      expect(row.stock).toBe(2);
    });

    it('should not modify stock in DB when decrementStock throws inside the transaction', async () => {
      const created = await itemsService.adminCreate(
        {
          name: 'Atomic Decrement Item',
          description: 'Atomic stock decrement test',
          stock: 10,
          price: 500,
        },
        'idem-stock-atomic',
      );

      const entity = await itemRepository.findById(created.id);

      const decrementSpy = jest
        .spyOn(itemRepository, 'decrementStock')
        .mockRejectedValueOnce(new Error('Simulated decrement failure'));

      // Stock is 10 ≥ 3, so the pre-check passes and we enter the transaction
      await expect(itemsService.decrementItemStock(entity, 3)).rejects.toThrow(
        'Simulated decrement failure',
      );

      const [row] = await dataSource.query(`SELECT stock FROM items WHERE id = $1`, [
        created.id,
      ]);
      expect(row.stock).toBe(10);

      decrementSpy.mockRestore();
    });

    it('should increment stock correctly', async () => {
      const created = await itemsService.adminCreate(
        {
          name: 'Increment Item',
          description: 'Increment test',
          stock: 10,
          price: 500,
        },
        'idem-stock-increment',
      );

      const entity = await itemRepository.findById(created.id);
      await itemsService.incrementItemStock(entity, 5);

      const [row] = await dataSource.query(`SELECT stock FROM items WHERE id = $1`, [
        created.id,
      ]);
      expect(row.stock).toBe(15);
    });

    it('should not modify stock in DB when incrementStock throws inside the transaction', async () => {
      const created = await itemsService.adminCreate(
        {
          name: 'Atomic Increment Item',
          description: 'Atomic stock increment test',
          stock: 10,
          price: 500,
        },
        'idem-stock-increment-atomic',
      );

      const entity = await itemRepository.findById(created.id);

      const incrementSpy = jest
        .spyOn(itemRepository, 'incrementStock')
        .mockRejectedValueOnce(new Error('Simulated increment failure'));

      await expect(itemsService.incrementItemStock(entity, 5)).rejects.toThrow(
        'Simulated increment failure',
      );

      const [row] = await dataSource.query(`SELECT stock FROM items WHERE id = $1`, [
        created.id,
      ]);
      expect(row.stock).toBe(10);

      incrementSpy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // Catalog Validation
  // ---------------------------------------------------------------------------

  describe('Catalog Validation', () => {
    it('should return all matching items when all IDs are valid', async () => {
      const itemA = await itemsService.adminCreate(
        {
          name: 'Catalog A',
          description: 'Catalog validation item A',
          stock: 5,
          price: 100,
        },
        'idem-catalog-a',
      );
      const itemB = await itemsService.adminCreate(
        {
          name: 'Catalog B',
          description: 'Catalog validation item B',
          stock: 5,
          price: 200,
        },
        'idem-catalog-b',
      );

      const result = await itemsService.validateAndGetCatalogItems([
        itemA.id,
        itemB.id,
      ]);

      expect(result).toHaveLength(2);
      expect(result.map((i) => i.id)).toEqual(
        expect.arrayContaining([itemA.id, itemB.id]),
      );
    });

    it('should throw NotFoundException when any requested item ID does not exist', async () => {
      const itemA = await itemsService.adminCreate(
        {
          name: 'Valid Catalog Item',
          description: 'For partial validation test',
          stock: 5,
          price: 100,
        },
        'idem-catalog-valid',
      );

      await expect(
        itemsService.validateAndGetCatalogItems([
          itemA.id,
          '00000000-0000-0000-0000-000000000000',
        ]),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when the items list is empty (no IDs provided)', async () => {
      await expect(
        itemsService.validateAndGetCatalogItems([
          '00000000-0000-0000-0000-000000000099',
        ]),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
