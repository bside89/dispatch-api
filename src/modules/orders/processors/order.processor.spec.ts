import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { OrderProcessor } from './order.processor';
import { OrderJobHandlerFactory } from '../factories/order-job-handler.factory';
import { CacheService } from '../../cache/cache.service';
import { OrderJob } from '../enums/order-job.enum';

describe('OrderProcessor', () => {
  let processor: OrderProcessor;
  let factory: jest.Mocked<OrderJobHandlerFactory>;
  let cacheService: jest.Mocked<CacheService>;

  const makeJob = (name: string, data?: any): Job =>
    ({ id: 'job-1', name, data: data ?? {} }) as any;

  const mockHandler = { execute: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderProcessor,
        {
          provide: OrderJobHandlerFactory,
          useValue: { createHandler: jest.fn() },
        },
        {
          provide: CacheService,
          useValue: {
            setIfNotExists: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    processor = module.get<OrderProcessor>(OrderProcessor);
    factory = module.get(OrderJobHandlerFactory);
    cacheService = module.get(CacheService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should acquire the lock, execute the handler, and release the lock', async () => {
    const job = makeJob(OrderJob.PROCESS_ORDER);
    cacheService.setIfNotExists.mockResolvedValue(true);
    factory.createHandler.mockReturnValue(mockHandler as any);
    mockHandler.execute.mockResolvedValue(undefined);
    cacheService.delete.mockResolvedValue(undefined);

    await processor.process(job);

    expect(cacheService.setIfNotExists).toHaveBeenCalledWith(
      `lock:job:${job.id}`,
      '1',
      30 * 1000,
    );
    expect(factory.createHandler).toHaveBeenCalledWith(OrderJob.PROCESS_ORDER);
    expect(mockHandler.execute).toHaveBeenCalledWith(job, expect.any(Logger));
    expect(cacheService.delete).toHaveBeenCalledWith(`lock:job:${job.id}`);
  });

  it('should skip processing and not acquire the lock if job is already running', async () => {
    const job = makeJob(OrderJob.SHIP_ORDER);
    cacheService.setIfNotExists.mockResolvedValue(false); // lock already held

    await processor.process(job);

    expect(factory.createHandler).not.toHaveBeenCalled();
    expect(cacheService.delete).not.toHaveBeenCalled();
  });

  it('should log a warning and skip when the job type is unknown', async () => {
    const job = makeJob('UNKNOWN_JOB_TYPE');
    cacheService.setIfNotExists.mockResolvedValue(true);
    factory.createHandler.mockReturnValue(null);
    cacheService.delete.mockResolvedValue(undefined);

    await processor.process(job);

    expect(mockHandler.execute).not.toHaveBeenCalled();
    // Lock must still be released in the finally block
    expect(cacheService.delete).toHaveBeenCalledWith(`lock:job:${job.id}`);
  });

  it('should release the lock even when the handler throws', async () => {
    const job = makeJob(OrderJob.DELIVER_ORDER);
    cacheService.setIfNotExists.mockResolvedValue(true);
    factory.createHandler.mockReturnValue(mockHandler as any);
    mockHandler.execute.mockRejectedValue(new Error('handler failed'));
    cacheService.delete.mockResolvedValue(undefined);

    await expect(processor.process(job)).rejects.toThrow('handler failed');

    expect(cacheService.delete).toHaveBeenCalledWith(`lock:job:${job.id}`);
  });

  it('should route each job type to the correct handler', async () => {
    const jobTypes = [
      OrderJob.PROCESS_ORDER,
      OrderJob.SHIP_ORDER,
      OrderJob.DELIVER_ORDER,
      OrderJob.CANCEL_ORDER,
    ];
    cacheService.setIfNotExists.mockResolvedValue(true);
    factory.createHandler.mockReturnValue(mockHandler as any);
    mockHandler.execute.mockResolvedValue(undefined);
    cacheService.delete.mockResolvedValue(undefined);

    for (const jobType of jobTypes) {
      const job = makeJob(jobType);
      await processor.process(job);
      expect(factory.createHandler).toHaveBeenCalledWith(jobType);
    }
  });
});
