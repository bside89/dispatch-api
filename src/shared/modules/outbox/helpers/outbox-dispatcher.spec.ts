import { OutboxDispatcher } from './outbox-dispatcher';
import { OutboxType } from '../enums/outbox-type.enum';
import { Outbox } from '../entities/outbox.entity';

describe('OutboxDispatcher', () => {
  it('should partition outbox messages by target transport', () => {
    const messages = [
      {
        id: '1',
        type: OutboxType.ORDER_PROCESS,
        payload: { type: OutboxType.ORDER_PROCESS, a: 1 },
        correlationId: 'corr-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '2',
        type: OutboxType.PAYMENT_UPDATE_CUSTOMER,
        payload: { type: OutboxType.PAYMENT_UPDATE_CUSTOMER, b: 2 },
        correlationId: 'corr-2',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '3',
        type: OutboxType.EFFECTS_NOTIFY_USER,
        payload: { type: OutboxType.EFFECTS_NOTIFY_USER, c: 3 },
        correlationId: 'corr-3',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '4',
        type: OutboxType.ORDER_CANCEL,
        payload: { type: OutboxType.ORDER_CANCEL, d: 4 },
        correlationId: 'corr-4',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as unknown as Outbox[];

    const result = OutboxDispatcher.partition(messages);

    expect(result.orderQueueMsg).toEqual([
      {
        name: OutboxType.ORDER_PROCESS,
        data: { type: OutboxType.ORDER_PROCESS, a: 1 },
        opts: { jobId: '1' },
      },
      {
        name: OutboxType.ORDER_CANCEL,
        data: { type: OutboxType.ORDER_CANCEL, d: 4 },
        opts: { jobId: '4' },
      },
    ]);

    expect(result.paymentQueueMsg).toEqual([
      {
        name: OutboxType.PAYMENT_UPDATE_CUSTOMER,
        data: { type: OutboxType.PAYMENT_UPDATE_CUSTOMER, b: 2 },
        opts: { jobId: '2' },
      },
    ]);

    expect(result.effectQueueMsg).toEqual([
      {
        name: OutboxType.EFFECTS_NOTIFY_USER,
        data: { type: OutboxType.EFFECTS_NOTIFY_USER, c: 3 },
        opts: { jobId: '3' },
      },
    ]);
  });
});
