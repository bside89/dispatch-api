import { Test, TestingModule } from '@nestjs/testing';
import { OutboxService } from './outbox.service';
import { OutboxRepository } from './repositories/outbox.repository';

describe('OutboxService', () => {
  let service: OutboxService;
  let repository: jest.Mocked<OutboxRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxService,
        {
          provide: OutboxRepository,
          useValue: {
            createEntity: jest.fn(),
            save: jest.fn(),
            findAllByCreatedAt: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OutboxService>(OutboxService);
    repository = module.get(OutboxRepository) as jest.Mocked<OutboxRepository>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
