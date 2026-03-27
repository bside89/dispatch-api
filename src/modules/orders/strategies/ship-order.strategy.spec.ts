import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ShipOrderStrategy } from './ship-order.strategy';
import { Order } from '../entities/order.entity';
import { OrderStatus } from '../enums/order-status.enum';
import { OrderJob } from '../enums/order-job.enum';
import { CacheService } from '../../cache/cache.service';
import { EVENT_BUS } from '../../events/constants/event-bus.token';
import { DeliverOrderJobData, ShipOrderJobData } from '../misc/order-job-data';

jest.mock('../../../shared/helpers/functions', () => ({
  delay: jest.fn().mockResolvedValue(undefined),
}));

describe('ShipOrderStrategy', () => {
  let strategy: ShipOrderStrategy;
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

  const makeJob = (data: ShipOrderJobData): Job<ShipOrderJobData> =>
    ({ data, id: 'job-2' }) as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShipOrderStrategy,
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

    strategy = module.get<ShipOrderStrategy>(ShipOrderStrategy);
    orderQueue = module.get(getQueueToken('orders'));
    orderRepository = module.get(getRepositoryToken(Order));
    eventBus = module.get(EVENT_BUS);
    cacheService = module.get(CacheService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('execute', () => {
    const jobData = new ShipOrderJobData('user-1', 'order-1');

    it('should update status to SHIPPED, notify user, and enqueue DELIVER_ORDER job', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);
      orderRepository.findOne.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.PROCESSED,
      });
      orderRepository.update.mockResolvedValue(undefined);
      eventBus.publish.mockResolvedValue(undefined);
      orderQueue.add.mockResolvedValue(undefined);

      await strategy.execute(makeJob(jobData), logger);

      expect(cacheService.get).toHaveBeenCalledWith(
        'idempotency:order:ship:order-1',
      );
      expect(cacheService.set).toHaveBeenCalledWith(
        'idempotency:order:ship:order-1',
        '1',
        3600,
      );
      expect(orderRepository.update).toHaveBeenCalledWith('order-1', {
        status: OrderStatus.SHIPPED,
      });
      expect(eventBus.publish).toHaveBeenCalledTimes(1);
      expect(orderQueue.add).toHaveBeenCalledWith(
        OrderJob.DELIVER_ORDER,
        expect.any(DeliverOrderJobData),
      );
      const enqueuedJobData = orderQueue.add.mock
        .calls[0][1] as DeliverOrderJobData;
      expect(enqueuedJobData.userId).toBe('user-1');
      expect(enqueuedJobData.orderId).toBe('order-1');
    });

    it('should skip and return early when idempotency key already exists in cache', async () => {
      cacheService.get.mockResolvedValue('1');

      await strategy.execute(makeJob(jobData), logger);

      expect(cacheService.set).not.toHaveBeenCalled();
      expect(orderRepository.update).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
      expect(orderQueue.add).not.toHaveBeenCalled();
    });

    it('should skip when order is already in SHIPPED status', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);
      orderRepository.findOne.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.SHIPPED,
      });

      await strategy.execute(makeJob(jobData), logger);

      expect(orderRepository.update).not.toHaveBeenCalled();
      expect(orderQueue.add).not.toHaveBeenCalled();
    });

    it('should remove idempotency key and rethrow on error', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);
      orderRepository.findOne.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.PROCESSED,
      });
      const dbError = new Error('DB connection lost');
      orderRepository.update.mockRejectedValue(dbError);
      cacheService.delete.mockResolvedValue(undefined);

      await expect(strategy.execute(makeJob(jobData), logger)).rejects.toThrow(
        'DB connection lost',
      );

      expect(cacheService.delete).toHaveBeenCalledWith(
        'idempotency:order:ship:order-1',
      );
    });

    it('should include orderId in the notification message', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);
      orderRepository.findOne.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.PROCESSED,
      });
      orderRepository.update.mockResolvedValue(undefined);
      eventBus.publish.mockResolvedValue(undefined);
      orderQueue.add.mockResolvedValue(undefined);

      await strategy.execute(makeJob(jobData), logger);

      const [notifyPayload] = eventBus.publish.mock.calls[0];
      expect(notifyPayload.userId).toBe('user-1');
      expect(notifyPayload.message).toContain('order-1');
    });
  });
});
