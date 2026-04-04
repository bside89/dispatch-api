import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { NotificationJobStrategy } from './notification-job.strategy';
import { CacheService } from '../../../../modules/cache/cache.service';

describe(NotificationJobStrategy.name, () => {
  let strategy: NotificationJobStrategy;
  let cacheService: jest.Mocked<CacheService>;
  let logger: jest.Mocked<Logger>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationJobStrategy,
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

    strategy = module.get<NotificationJobStrategy>(NotificationJobStrategy);
    cacheService = module.get(CacheService) as jest.Mocked<CacheService>;
    logger = {
      log: jest.fn(),
    } as unknown as jest.Mocked<Logger>;
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });
});
