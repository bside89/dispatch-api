import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ProcessOrderStrategy } from './process-order.strategy';
import { Order } from '../entities/order.entity';
import { OrderStatus } from '../enums/order-status.enum';
import { OrderJob } from '../enums/order-job.enum';
import { CacheService } from '../../cache/cache.service';
import { EVENT_BUS } from '../../events/constants/event-bus.token';
import { ProcessOrderJobData, ShipOrderJobData } from '../misc/order-job-data';

jest.mock('../../../shared/helpers/functions', () => ({
  delay: jest.fn().mockResolvedValue(undefined),
}));

describe('ProcessOrderStrategy', () => {
  let strategy: ProcessOrderStrategy;
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

  const makeJob = (data: ProcessOrderJobData): Job<ProcessOrderJobData> =>
    ({ data, id: 'job-1' }) as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessOrderStrategy,
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

    strategy = module.get<ProcessOrderStrategy>(ProcessOrderStrategy);
    orderQueue = module.get(getQueueToken('orders'));
    orderRepository = module.get(getRepositoryToken(Order));
    eventBus = module.get(EVENT_BUS);
    cacheService = module.get(CacheService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('execute', () => {
    const jobData = new ProcessOrderJobData('user-1', 'order-1', 100);

    it('should update status to PROCESSED, notify user, and enqueue SHIP_ORDER job', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);
      orderRepository.findOne.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.PENDING,
      });
      orderRepository.update.mockResolvedValue(undefined);
      eventBus.publish.mockResolvedValue(undefined);
      orderQueue.add.mockResolvedValue(undefined);

      await strategy.execute(makeJob(jobData), logger);

      expect(cacheService.get).toHaveBeenCalledWith(
        'idempotency:order:process:order-1',
      );
      expect(cacheService.set).toHaveBeenCalledWith(
        'idempotency:order:process:order-1',
        '1',
        3600000,
      );
      expect(orderRepository.update).toHaveBeenCalledWith('order-1', {
        status: OrderStatus.PROCESSED,
      });
      expect(eventBus.publish).toHaveBeenCalledTimes(1);
      expect(orderQueue.add).toHaveBeenCalledWith(
        OrderJob.SHIP_ORDER,
        expect.any(ShipOrderJobData),
      );
      const enqueuedJobData = orderQueue.add.mock
        .calls[0][1] as ShipOrderJobData;
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

    it('should skip processing when order is already in PROCESSED status', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);
      orderRepository.findOne.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.PROCESSED,
      });

      await strategy.execute(makeJob(jobData), logger);

      expect(orderRepository.update).not.toHaveBeenCalled();
      expect(orderQueue.add).not.toHaveBeenCalled();
    });

    it('should remove idempotency key and rethrow when total is invalid', async () => {
      const badJobData = new ProcessOrderJobData('user-1', 'order-1', 0);
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);
      orderRepository.findOne.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.PENDING,
      });
      cacheService.delete.mockResolvedValue(undefined);

      await expect(
        strategy.execute(makeJob(badJobData), logger),
      ).rejects.toThrow('Invalid order total');

      expect(cacheService.delete).toHaveBeenCalledWith(
        'idempotency:order:process:order-1',
      );
      expect(orderRepository.update).not.toHaveBeenCalled();
    });

    it('should include orderId in the notification message', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);
      orderRepository.findOne.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.PENDING,
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
