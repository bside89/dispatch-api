/*eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsProcessor } from './payments.processor';
import { PaymentJobHandlerFactory } from '../factories/payment-job-handler.factory';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '@/shared/modules/cache/cache.service';
import { CACHE_SERVICE } from '@/shared/modules/cache/constants/cache.token';
import Redlock from 'redlock';

describe('PaymentsProcessor', () => {
  let processor: PaymentsProcessor;
  let factory: jest.Mocked<PaymentJobHandlerFactory>;
  let configService: jest.Mocked<ConfigService>;
  let cacheService: jest.Mocked<CacheService>;
  let redlock: jest.Mocked<Redlock>;

  beforeEach(async () => {
    factory = {
      getHandler: jest.fn(),
    } as any;

    configService = {
      get: jest.fn(),
    } as any;

    cacheService = {
      get: jest.fn(),
      set: jest.fn(),
    } as any;

    redlock = {} as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsProcessor,
        { provide: PaymentJobHandlerFactory, useValue: factory },
        { provide: ConfigService, useValue: configService },
        { provide: CACHE_SERVICE, useValue: cacheService },
        { provide: Redlock, useValue: redlock },
      ],
    }).compile();

    processor = module.get<PaymentsProcessor>(PaymentsProcessor);
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });
});
