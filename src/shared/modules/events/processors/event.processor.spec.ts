/*eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { EventProcessor } from './event.processor';
import { NotifyUserJobStrategy } from '../strategies/notify-user-job.strategy';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../cache/cache.service';
import { CACHE_SERVICE } from '../../cache/constants/cache.token';
import Redlock from 'redlock';
import { EventJobHandlerFactory } from '../factories/event-job-handler.factory';
import {
  createCacheServiceMock,
  createRedlockMock,
} from '@/shared/testing/provider-mocks';

describe('EventProcessor', () => {
  let processor: EventProcessor;
  let notificationStrategy: jest.Mocked<NotifyUserJobStrategy>;
  let cacheService: jest.Mocked<CacheService>;
  let factory: jest.Mocked<EventJobHandlerFactory>;

  beforeEach(async () => {
    notificationStrategy = {
      execute: jest.fn(),
    } as any;

    cacheService = createCacheServiceMock() as any;

    factory = {
      getStrategy: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventProcessor,
        {
          provide: NotifyUserJobStrategy,
          useValue: notificationStrategy,
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
        {
          provide: CACHE_SERVICE,
          useValue: cacheService,
        },
        {
          provide: Redlock,
          useValue: createRedlockMock(),
        },
        {
          provide: EventJobHandlerFactory,
          useValue: factory,
        },
      ],
    }).compile();

    processor = module.get<EventProcessor>(EventProcessor);
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });
});
