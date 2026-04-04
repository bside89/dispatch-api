import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { EventProcessor } from './event.processor';
import { NotificationStrategy } from '../strategies/notification.strategy';
import { OutboxType } from '../../../../shared/modules/outbox/enums/outbox-type.enum';
import { RequestContext } from '../../../../shared/utils/request-context';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../../../modules/cache/cache.service';
import Redlock from 'redlock';

describe('EventProcessor', () => {
  let processor: EventProcessor;
  let notificationStrategy: jest.Mocked<NotificationStrategy>;
  let cacheService: jest.Mocked<CacheService>;

  beforeEach(async () => {
    notificationStrategy = {
      execute: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventProcessor,
        {
          provide: NotificationStrategy,
          useValue: notificationStrategy,
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
        {
          provide: CacheService,
          useValue: {
            delete: jest.fn(),
          },
        },
        {
          provide: Redlock,
          useValue: { acquire: jest.fn(), release: jest.fn() },
        },
      ],
    }).compile();

    processor = module.get<EventProcessor>(EventProcessor);
    cacheService = module.get<CacheService>(CacheService);
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });
});
