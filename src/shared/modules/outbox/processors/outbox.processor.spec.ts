import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { OutboxProcessor } from './outbox.processor';
import { OutboxRepository } from '../repositories/outbox.repository';
import { EVENT_BUS } from '../../../../shared/modules/events/constants/event-bus.token';
import { EventBus } from '../../../../shared/modules/events/interfaces/event-bus.interface';

describe('OutboxProcessor', () => {
  let processor: OutboxProcessor;
  let module: TestingModule;

  const mockOrderQueue = {
    add: jest.fn(),
  };

  const mockEventBus: jest.Mocked<EventBus> = {
    publish: jest.fn(),
  };

  const mockOutboxRepository = {
    findAllByCreatedAt: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        OutboxProcessor,
        {
          provide: getQueueToken('orders'),
          useValue: mockOrderQueue,
        },
        {
          provide: EVENT_BUS,
          useValue: mockEventBus,
        },
        {
          provide: OutboxRepository,
          useValue: mockOutboxRepository,
        },
      ],
    }).compile();

    processor = module.get<OutboxProcessor>(OutboxProcessor);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });
});
