import { Test, TestingModule } from '@nestjs/testing';
import { OrderProcessor } from './order.processor';
import { OrderJobHandlerFactory } from '../factories/order-job-handler.factory';
import { CacheService } from '../../cache/cache.service';
import { Job } from 'bullmq';
import { RequestContext } from '../../../shared/utils/request-context';
import { ConfigService } from '@nestjs/config';

describe('OrderProcessor', () => {
  let processor: OrderProcessor;
  let factory: jest.Mocked<OrderJobHandlerFactory>;
  let cacheService: jest.Mocked<CacheService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    factory = {
      createHandler: jest.fn(),
    } as any;

    cacheService = {
      setIfNotExists: jest.fn(),
      delete: jest.fn(),
    } as any;

    configService = {
      get: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderProcessor,
        { provide: OrderJobHandlerFactory, useValue: factory },
        { provide: CacheService, useValue: cacheService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    processor = module.get<OrderProcessor>(OrderProcessor);
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  it('should process job successfully with lock', async () => {
    const job = {
      id: '123',
      name: 'test-job',
      data: { correlationId: 'test-id' },
    } as Job;

    const mockHandler = { execute: jest.fn() };
    factory.createHandler.mockReturnValue(mockHandler);
    cacheService.setIfNotExists.mockResolvedValue(true);
    cacheService.delete.mockResolvedValue(undefined);

    jest
      .spyOn(RequestContext, 'run')
      .mockImplementation((_, callback) => callback());

    await processor.process(job);

    expect(cacheService.setIfNotExists).toHaveBeenCalledWith(
      'lock:job:123',
      '1',
      expect.any(Number),
    );
    expect(mockHandler.execute).toHaveBeenCalledWith(job, expect.any(Object));
    expect(cacheService.delete).toHaveBeenCalledWith('lock:job:123');
  });

  it('should skip job if lock already exists', async () => {
    const job = {
      id: '123',
      name: 'test-job',
      data: { correlationId: 'test-id' },
    } as Job;

    cacheService.setIfNotExists.mockResolvedValue(false);

    jest
      .spyOn(RequestContext, 'run')
      .mockImplementation((_, callback) => callback());

    await processor.process(job);

    expect(cacheService.setIfNotExists).toHaveBeenCalled();
    expect(factory.createHandler).not.toHaveBeenCalled();
    expect(cacheService.delete).not.toHaveBeenCalled();
  });

  it('should handle unknown job name', async () => {
    const job = {
      id: '123',
      name: 'unknown-job',
      data: { correlationId: 'test-id' },
    } as Job;

    factory.createHandler.mockReturnValue(null);
    cacheService.setIfNotExists.mockResolvedValue(true);
    cacheService.delete.mockResolvedValue(undefined);

    jest
      .spyOn(RequestContext, 'run')
      .mockImplementation((_, callback) => callback());

    await processor.process(job);

    expect(factory.createHandler).toHaveBeenCalledWith('unknown-job');
    expect(cacheService.delete).toHaveBeenCalledWith('lock:job:123');
  });
});
