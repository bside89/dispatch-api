import { Test, TestingModule } from '@nestjs/testing';
import { NotifyUserJobStrategy } from './notify-user-job.strategy';
import { CacheService } from '../../cache/cache.service';

describe('NotifyUserJobStrategy', () => {
  let strategy: NotifyUserJobStrategy;

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
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });
});
