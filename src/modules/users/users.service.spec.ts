import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { UserRepository } from './repositories/user.repository';
import { CacheService } from '../../shared/modules/cache/cache.service';
import { OutboxService } from '../../shared/modules/outbox/outbox.service';
import { DataSource } from 'typeorm';
import Redlock from 'redlock';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UserRepository,
          useValue: {
            findById: jest.fn(),
            findOneWhere: jest.fn(),
            createEntity: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
            findAllWithFilters: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
          },
        },
        {
          provide: OutboxService,
          useValue: {},
        },
        {
          provide: DataSource,
          useValue: {},
        },
        {
          provide: Redlock,
          useValue: { acquire: jest.fn(), release: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
