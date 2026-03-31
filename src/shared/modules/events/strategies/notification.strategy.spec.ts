import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { NotificationStrategy } from './notification.strategy';
import { CacheService } from '../../../../modules/cache/cache.service';

describe('NotificationStrategy', () => {
  let strategy: NotificationStrategy;
  let cacheService: jest.Mocked<CacheService>;
  let logger: jest.Mocked<Logger>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationStrategy,
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    strategy = module.get<NotificationStrategy>(NotificationStrategy);
    cacheService = module.get(CacheService) as jest.Mocked<CacheService>;
    logger = {
      log: jest.fn(),
    } as unknown as jest.Mocked<Logger>;
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });
});
