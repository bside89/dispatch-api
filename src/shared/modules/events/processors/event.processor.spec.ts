import { Test, TestingModule } from '@nestjs/testing';
import { EventProcessor } from './event.processor';
import { NotificationJobStrategy } from '../strategies/notification-job.strategy';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../../../modules/cache/cache.service';
import Redlock from 'redlock';

describe('EventProcessor', () => {
  let processor: EventProcessor;
  let notificationStrategy: jest.Mocked<NotificationJobStrategy>;
  let cacheService: jest.Mocked<CacheService>;

  beforeEach(async () => {
    notificationStrategy = {
      execute: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventProcessor,
        {
          provide: NotificationJobStrategy,
          useValue: notificationStrategy,
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
        {
          provide: CacheService,
          useValue: cacheService,
        },
        {
          provide: Redlock,
          useValue: { acquire: jest.fn(), release: jest.fn() },
        },
      ],
    }).compile();

    processor = module.get<EventProcessor>(EventProcessor);
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });
});
