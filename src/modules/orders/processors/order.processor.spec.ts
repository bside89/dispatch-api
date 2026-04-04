import { Test, TestingModule } from '@nestjs/testing';
import { OrderProcessor } from './order.processor';
import { OrderJobHandlerFactory } from '../factories/order-job-handler.factory';
import { CacheService } from '../../cache/cache.service';
import { Job } from 'bullmq';
import { RequestContext } from '../../../shared/utils/request-context';
import { ConfigService } from '@nestjs/config';
import Redlock from 'redlock';

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
        { provide: Redlock, useValue: { acquire: jest.fn(), release: jest.fn() } },
      ],
    }).compile();

    processor = module.get<OrderProcessor>(OrderProcessor);
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });
});
