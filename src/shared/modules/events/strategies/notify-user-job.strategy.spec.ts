import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { NotifyUserJobStrategy } from './notify-user-job.strategy';
import { CacheService } from '../../cache/cache.service';

describe(NotifyUserJobStrategy.name, () => {
  let strategy: NotifyUserJobStrategy;
  let cacheService: jest.Mocked<CacheService>;
  let logger: jest.Mocked<Logger>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotifyUserJobStrategy,
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

    strategy = module.get<NotifyUserJobStrategy>(NotifyUserJobStrategy);
    cacheService = module.get(CacheService) as jest.Mocked<CacheService>;
    logger = {
      log: jest.fn(),
    } as unknown as jest.Mocked<Logger>;
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });
});
