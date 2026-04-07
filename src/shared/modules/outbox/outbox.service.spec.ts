/*eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { OutboxService } from './outbox.service';
import { OutboxRepository } from './repositories/outbox.repository';
import { getQueueToken } from '@nestjs/bullmq';
import { ORDER_QUEUE_TOKEN } from '@/shared/constants/queue-tokens';
import { EVENT_BUS } from '../events/constants/event-bus.token';
import { DataSource } from 'typeorm';
import { OutboxType } from './enums/outbox-type.enum';
import { Outbox } from './entities/outbox.entity';
import { RequestContext } from '@/shared/utils/request-context';
import {
  CancelOrderJobPayload,
  ProcessOrderJobPayload,
} from '@/shared/payloads/order-job.payload';
import { OutboxPayload } from './types/outbox.payload';

const makeOutbox = (overrides: Partial<Outbox> = {}): Outbox =>
  ({
    id: 'uuid-1',
    type: OutboxType.ORDER_PROCESS,
    payload: makeOutboxPayload({ orderId: '1' }),
    correlationId: 'corr-1',
    createdAt: new Date(),
    ...overrides,
  }) as Outbox;

const makeOutboxPayload = (overrides: Partial<OutboxPayload> = {}): OutboxPayload =>
  ({
    orderId: '1',
    ...overrides,
  }) as OutboxPayload;

describe(OutboxService.name, () => {
  let service: OutboxService;
  let repository: jest.Mocked<
    Pick<
      OutboxRepository,
      'createEntity' | 'save' | 'findAndLockBatch' | 'deleteBulk'
    >
  >;
  let orderQueue: { addBulk: jest.Mock };
  let eventBus: { publish: jest.Mock; publishBulk: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxService,
        {
          provide: OutboxRepository,
          useValue: {
            createEntity: jest.fn(),
            save: jest.fn(),
            findAndLockBatch: jest.fn(),
            deleteBulk: jest.fn(),
          },
        },
        {
          provide: getQueueToken(ORDER_QUEUE_TOKEN),
          useValue: {
            add: jest.fn(),
            addBulk: jest.fn(),
          },
        },
        {
          provide: EVENT_BUS,
          useValue: {
            publish: jest.fn(),
            publishBulk: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn((cb) => cb({})),
          },
        },
      ],
    }).compile();

    service = module.get<OutboxService>(OutboxService);
    repository = module.get(OutboxRepository);
    orderQueue = module.get(getQueueToken(ORDER_QUEUE_TOKEN));
    eventBus = module.get(EVENT_BUS);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('process()', () => {
    it('should skip if shutting down', async () => {
      (service as any).isShuttingDown = true;

      await service.process();

      expect(repository.findAndLockBatch).not.toHaveBeenCalled();
    });

    it('should skip if already processing', async () => {
      (service as any).isProcessing = true;

      await service.process();

      expect(repository.findAndLockBatch).not.toHaveBeenCalled();
    });

    it('should return early when there are no messages', async () => {
      (repository.findAndLockBatch as jest.Mock).mockResolvedValue([]);

      await service.process();

      expect(repository.deleteBulk).not.toHaveBeenCalled();
    });

    it('should dispatch order-type messages to the order queue and delete them', async () => {
      const messages = [
        makeOutbox({
          id: 'uuid-1',
          type: OutboxType.ORDER_PROCESS,
          payload: makeOutboxPayload({ orderId: '1' }),
        }),
        makeOutbox({
          id: 'uuid-2',
          type: OutboxType.ORDER_SHIP,
          payload: makeOutboxPayload({ orderId: '2' }),
        }),
      ];
      (repository.findAndLockBatch as jest.Mock).mockResolvedValue(messages);
      (orderQueue.addBulk as jest.Mock).mockResolvedValue([]);
      (repository.deleteBulk as jest.Mock).mockResolvedValue(undefined);

      await service.process();

      expect(orderQueue.addBulk).toHaveBeenCalledWith([
        {
          name: OutboxType.ORDER_PROCESS,
          data: { orderId: '1' },
          jobId: 'uuid-1',
        },
        {
          name: OutboxType.ORDER_SHIP,
          data: { orderId: '2' },
          jobId: 'uuid-2',
        },
      ]);
      expect(repository.deleteBulk).toHaveBeenCalledWith(['uuid-1', 'uuid-2']);
    });

    it('should dispatch EVENTS_NOTIFY_USER messages to the event bus and delete them', async () => {
      const messages = [
        makeOutbox({
          id: 'uuid-3',
          type: OutboxType.EVENTS_NOTIFY_USER,
          payload: makeOutboxPayload({ userId: 'u1' }),
        }),
      ];
      (repository.findAndLockBatch as jest.Mock).mockResolvedValue(messages);
      (eventBus.publishBulk as jest.Mock).mockResolvedValue(undefined);
      (repository.deleteBulk as jest.Mock).mockResolvedValue(undefined);

      await service.process();

      expect(eventBus.publishBulk).toHaveBeenCalledWith([
        {
          name: OutboxType.EVENTS_NOTIFY_USER,
          data: { orderId: '1', userId: 'u1' },
          jobId: 'uuid-3',
        },
      ]);
      expect(repository.deleteBulk).toHaveBeenCalledWith(['uuid-3']);
    });

    it('should schedule the next execution with setImmediate when batch is full', async () => {
      const limit = 100;
      const messages = Array.from({ length: limit }, (_, i) =>
        makeOutbox({ id: `uuid-${i}`, type: OutboxType.ORDER_PROCESS }),
      );
      (repository.findAndLockBatch as jest.Mock).mockResolvedValue(messages);
      (orderQueue.addBulk as jest.Mock).mockResolvedValue([]);
      (repository.deleteBulk as jest.Mock).mockResolvedValue(undefined);

      const setImmediateSpy = jest
        .spyOn(global, 'setImmediate')
        .mockImplementation((_cb: any) => ({}) as any);

      await service.process();

      expect(setImmediateSpy).toHaveBeenCalledWith(expect.any(Function));
      setImmediateSpy.mockRestore();
    });

    it('should release isProcessing after an error', async () => {
      (repository.findAndLockBatch as jest.Mock).mockRejectedValue(
        new Error('DB error'),
      );

      await service.process();

      expect((service as any).isProcessing).toBe(false);
    });
  });

  describe('add()', () => {
    it('should create and save an outbox entry using correlationId from context', async () => {
      const type = OutboxType.ORDER_PROCESS;
      const payload = new ProcessOrderJobPayload('user-1', '123', 'user-name-1');
      const correlationId = 'ctx-correlation-id';
      const mockEntry = makeOutbox({ type, payload, correlationId });

      (repository.createEntity as jest.Mock).mockReturnValue(mockEntry);
      (repository.save as jest.Mock).mockResolvedValue(mockEntry);

      await RequestContext.run(correlationId, async () => {
        await service.add(type, payload);
      });

      expect(repository.createEntity).toHaveBeenCalledWith(
        expect.objectContaining({ type, payload, correlationId }),
      );
      expect(repository.save).toHaveBeenCalledWith(mockEntry);
    });

    it('should generate a UUID correlationId when context has none', async () => {
      const type = OutboxType.ORDER_CANCEL;
      const payload = new CancelOrderJobPayload('user-1', '456', 'user-name-1');
      const mockEntry = makeOutbox({ type, payload });

      (repository.createEntity as jest.Mock).mockReturnValue(mockEntry);
      (repository.save as jest.Mock).mockResolvedValue(mockEntry);

      await service.add(type, payload);

      expect(repository.createEntity).toHaveBeenCalledWith(
        expect.objectContaining({
          type,
          payload,
          correlationId: expect.stringMatching(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
          ),
        }),
      );
      expect(repository.save).toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy()', () => {
    it('should set isShuttingDown to true', async () => {
      await service.onModuleDestroy();

      expect((service as any).isShuttingDown).toBe(true);
    });

    it('should wait for ongoing processing to finish before resolving', async () => {
      (service as any).isProcessing = true;

      const destroyPromise = service.onModuleDestroy();

      setTimeout(() => {
        (service as any).isProcessing = false;
      }, 150);

      await destroyPromise;

      expect((service as any).isShuttingDown).toBe(true);
    });
  });
});
