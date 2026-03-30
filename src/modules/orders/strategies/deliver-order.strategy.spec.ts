import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';
import { getRepositoryToken } from '@nestjs/typeorm';

import { DeliverOrderStrategy } from './deliver-order.strategy';
import { Order } from '../entities/order.entity';
import { OrderStatus } from '../enums/order-status.enum';
import { CacheService } from '../../cache/cache.service';
import { EVENT_BUS } from '../../../shared/modules/events/constants/event-bus.token';
import { DeliverOrderJobPayload } from '../processors/payloads/order-job.payload';

jest.mock('../../../shared/helpers/functions', () => ({
  delay: jest.fn().mockResolvedValue(undefined),
}));

describe('DeliverOrderStrategy', () => {
  let strategy: DeliverOrderStrategy;
  let orderQueue: jest.Mocked<{ add: jest.Mock }>;
  let orderRepository: jest.Mocked<{ findOne: jest.Mock; update: jest.Mock }>;
  let eventBus: jest.Mocked<{ publish: jest.Mock }>;
  let cacheService: jest.Mocked<CacheService>;

  const logger = {
    log: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as Logger;

  const makeJob = (data: DeliverOrderJobPayload): Job<DeliverOrderJobPayload> =>
    ({ data, id: 'job-3' }) as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliverOrderStrategy,
        {
          provide: getQueueToken('orders'),
          useValue: { add: jest.fn() },
        },
        {
          provide: getRepositoryToken(Order),
          useValue: { findOne: jest.fn(), update: jest.fn() },
        },
        {
          provide: EVENT_BUS,
          useValue: { publish: jest.fn() },
        },
        {
          provide: CacheService,
          useValue: { get: jest.fn(), set: jest.fn(), delete: jest.fn() },
        },
      ],
    }).compile();

    strategy = module.get<DeliverOrderStrategy>(DeliverOrderStrategy);
    orderQueue = module.get(getQueueToken('orders'));
    orderRepository = module.get(getRepositoryToken(Order));
    eventBus = module.get(EVENT_BUS);
    cacheService = module.get(CacheService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('execute', () => {
    const jobData = new DeliverOrderJobPayload('user-1', 'order-1');

    it('should update status to DELIVERED and notify user', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);
      orderRepository.findOne.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.SHIPPED,
      });
      orderRepository.update.mockResolvedValue(undefined);
      eventBus.publish.mockResolvedValue(undefined);

      await strategy.execute(makeJob(jobData), logger);

      expect(cacheService.get).toHaveBeenCalledWith(
        'idempotency:order:deliver:order-1',
      );
      expect(cacheService.set).toHaveBeenCalledWith(
        'idempotency:order:deliver:order-1',
        '1',
        3600000,
      );
      expect(orderRepository.update).toHaveBeenCalledWith('order-1', {
        status: OrderStatus.DELIVERED,
      });
      expect(eventBus.publish).toHaveBeenCalledTimes(1);
      // Delivery is the final step — no further jobs should be queued
      expect(orderQueue.add).not.toHaveBeenCalled();
    });

    it('should skip and return early when idempotency key already exists in cache', async () => {
      cacheService.get.mockResolvedValue('1');

      await strategy.execute(makeJob(jobData), logger);

      expect(cacheService.set).not.toHaveBeenCalled();
      expect(orderRepository.update).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('should skip when order is already in DELIVERED status', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);
      orderRepository.findOne.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.DELIVERED,
      });

      await strategy.execute(makeJob(jobData), logger);

      expect(orderRepository.update).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('should remove idempotency key and rethrow on error', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);
      orderRepository.findOne.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.SHIPPED,
      });
      const dbError = new Error('DB connection lost');
      orderRepository.update.mockRejectedValue(dbError);
      cacheService.delete.mockResolvedValue(undefined);

      await expect(strategy.execute(makeJob(jobData), logger)).rejects.toThrow(
        'DB connection lost',
      );

      expect(cacheService.delete).toHaveBeenCalledWith(
        'idempotency:order:deliver:order-1',
      );
    });

    it('should include orderId in the delivery notification message', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);
      orderRepository.findOne.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.SHIPPED,
      });
      orderRepository.update.mockResolvedValue(undefined);
      eventBus.publish.mockResolvedValue(undefined);

      await strategy.execute(makeJob(jobData), logger);

      const [notifyPayload] = eventBus.publish.mock.calls[0];
      expect(notifyPayload.userId).toBe('user-1');
      expect(notifyPayload.message).toContain('order-1');
    });
  });
});
