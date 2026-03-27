import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { NotificationStrategy } from './notification.strategy';
import { CacheService } from '../../cache/cache.service';

jest.mock('../../../shared/helpers/functions', () => ({
  delay: jest.fn().mockResolvedValue(undefined),
}));

describe('NotificationStrategy', () => {
  let strategy: NotificationStrategy;
  let cacheService: jest.Mocked<CacheService>;

  const logger = {
    log: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as Logger;

  const makeJob = (data: {
    userId: string;
    notificationId: string;
    message: string;
  }): Job =>
    ({
      data,
      id: 'event-job-1',
    }) as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationStrategy,
        {
          provide: CacheService,
          useValue: { get: jest.fn(), set: jest.fn(), delete: jest.fn() },
        },
      ],
    }).compile();

    strategy = module.get<NotificationStrategy>(NotificationStrategy);
    cacheService = module.get(CacheService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('execute', () => {
    const jobData = {
      userId: 'user-1',
      notificationId: 'notif-abc',
      message: 'Your order has been processed',
    };

    it('should set idempotency key and deliver the notification', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);

      await strategy.execute(makeJob(jobData), logger);

      expect(cacheService.get).toHaveBeenCalledWith(
        'idempotency:event:user-1:notif-abc',
      );
      expect(cacheService.set).toHaveBeenCalledWith(
        'idempotency:event:user-1:notif-abc',
        '1',
        3600 * 1000,
      );
    });

    it('should skip and return early when the idempotency key already exists', async () => {
      cacheService.get.mockResolvedValue('1');

      await strategy.execute(makeJob(jobData), logger);

      expect(cacheService.set).not.toHaveBeenCalled();
    });

    it('should remove idempotency key and rethrow when notification delivery fails', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);
      cacheService.delete.mockResolvedValue(undefined);

      // Import the mocked delay to force it to throw
      const { delay } = require('../../../shared/helpers/functions');
      (delay as jest.Mock).mockRejectedValueOnce(
        new Error('Notification service unavailable'),
      );

      await expect(strategy.execute(makeJob(jobData), logger)).rejects.toThrow(
        'Notification service unavailable',
      );

      expect(cacheService.delete).toHaveBeenCalledWith(
        'idempotency:event:user-1:notif-abc',
      );
    });

    it('should use a composite key of userId and notificationId', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);

      const customData = {
        userId: 'user-xyz',
        notificationId: 'notif-999',
        message: 'Hello',
      };

      await strategy.execute(makeJob(customData), logger);

      expect(cacheService.get).toHaveBeenCalledWith(
        'idempotency:event:user-xyz:notif-999',
      );
    });
  });
});
