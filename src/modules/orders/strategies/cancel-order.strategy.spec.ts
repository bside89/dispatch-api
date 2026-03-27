import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';
import { getRepositoryToken } from '@nestjs/typeorm';

import { CancelOrderStrategy } from './cancel-order.strategy';
import { Order } from '../entities/order.entity';
import { OrderStatus } from '../enums/order-status.enum';
import { CacheService } from '../../cache/cache.service';
import { EVENT_BUS } from '../../events/constants/event-bus.token';
import { CancelOrderJobData } from '../misc/order-job-data';

jest.mock('../../common/helpers/helpers', () => ({
  delay: jest.fn().mockResolvedValue(undefined),
}));

describe('CancelOrderStrategy', () => {
  let strategy: CancelOrderStrategy;
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

  const makeJob = (data: CancelOrderJobData): Job<CancelOrderJobData> =>
    ({ data, id: 'job-cancel' } as any);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CancelOrderStrategy,
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

    strategy = module.get<CancelOrderStrategy>(CancelOrderStrategy);
    orderQueue = module.get(getQueueToken('orders'));
    orderRepository = module.get(getRepositoryToken(Order));
    eventBus = module.get(EVENT_BUS);
    cacheService = module.get(CacheService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('execute', () => {
    // Note: CancelOrderJobData(userId, orderId)
    const jobData = new CancelOrderJobData('user-1', 'order-1');

    it('should update status to CANCELLED and notify user', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);
      orderRepository.findOne.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.PENDING,
      });
      orderRepository.update.mockResolvedValue(undefined);
      eventBus.publish.mockResolvedValue(undefined);

      await strategy.execute(makeJob(jobData), logger);

      expect(cacheService.get).toHaveBeenCalledWith(
        'idempotency:order:cancel:order-1',
      );
      expect(cacheService.set).toHaveBeenCalledWith(
        'idempotency:order:cancel:order-1',
        '1',
        3600,
      );
      expect(orderRepository.update).toHaveBeenCalledWith('order-1', {
        status: OrderStatus.CANCELLED,
      });
      expect(eventBus.publish).toHaveBeenCalledTimes(1);
      // Cancel does not enqueue further jobs
      expect(orderQueue.add).not.toHaveBeenCalled();
    });

    it('should skip and return early when idempotency key already exists in cache', async () => {
      cacheService.get.mockResolvedValue('1');

      await strategy.execute(makeJob(jobData), logger);

      expect(cacheService.set).not.toHaveBeenCalled();
      expect(orderRepository.update).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('should skip when order is already CANCELLED', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);
      orderRepository.findOne.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.CANCELLED,
      });

      await strategy.execute(makeJob(jobData), logger);

      expect(orderRepository.update).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('should skip when order is already REFUNDED', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);
      orderRepository.findOne.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.REFUNDED,
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
        status: OrderStatus.PENDING,
      });
      const dbError = new Error('DB error during cancel');
      orderRepository.update.mockRejectedValue(dbError);
      cacheService.delete.mockResolvedValue(undefined);

      await expect(strategy.execute(makeJob(jobData), logger)).rejects.toThrow(
        'DB error during cancel',
      );

      expect(cacheService.delete).toHaveBeenCalledWith(
        'idempotency:order:cancel:order-1',
      );
    });

    it('should include orderId in the cancellation notification message', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);
      orderRepository.findOne.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.PENDING,
      });
      orderRepository.update.mockResolvedValue(undefined);
      eventBus.publish.mockResolvedValue(undefined);

      await strategy.execute(makeJob(jobData), logger);

      const [notifyPayload] = eventBus.publish.mock.calls[0];
      expect(notifyPayload.userId).toBe('user-1');
      expect(notifyPayload.message).toContain('order-1');
      expect(notifyPayload.message).toContain('cancelled');
    });
  });
});
