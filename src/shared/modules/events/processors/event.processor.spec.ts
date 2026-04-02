import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { EventProcessor } from './event.processor';
import { NotificationStrategy } from '../strategies/notification.strategy';
import { OutboxType } from '../../../../shared/modules/outbox/enums/outbox-type.enum';
import { RequestContext } from '../../../../shared/utils/request-context';
import { ConfigService } from '@nestjs/config';

describe('EventProcessor', () => {
  let processor: EventProcessor;
  let notificationStrategy: jest.Mocked<NotificationStrategy>;

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
      ],
    }).compile();

    processor = module.get<EventProcessor>(EventProcessor);
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  it('should process EVENTS_NOTIFY_USER job', async () => {
    const job = {
      name: OutboxType.EVENTS_NOTIFY_USER,
      data: { correlationId: '123' },
    } as unknown as Job;

    notificationStrategy.execute.mockResolvedValue(undefined);
    jest.spyOn(RequestContext, 'run').mockImplementation((id, fn) => fn());

    await processor.process(job);

    expect(notificationStrategy.execute).toHaveBeenCalledWith(
      job,
      expect.anything(),
    );
  });

  it('should use randomUUID when correlationId is not provided', async () => {
    const job = {
      name: OutboxType.EVENTS_NOTIFY_USER,
      data: {},
    } as unknown as Job;

    notificationStrategy.execute.mockResolvedValue(undefined);
    jest.spyOn(RequestContext, 'run').mockImplementation((id, fn) => fn());

    await processor.process(job);

    expect(RequestContext.run).toHaveBeenCalled();
  });
});
