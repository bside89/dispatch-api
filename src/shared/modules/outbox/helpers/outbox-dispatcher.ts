import { Outbox } from '../entities/outbox.entity';
import { OutboxType } from '../enums/outbox-type.enum';
import { QueueJob } from '@/shared/interfaces/queue-job.interface';
import { BaseOutboxJobPayload } from '../payloads/outbox.payload';

type OutboxDispatchPlan = {
  orderQueueMsg: QueueJob<BaseOutboxJobPayload>[];
  paymentQueueMsg: QueueJob<BaseOutboxJobPayload>[];
  effectQueueMsg: QueueJob<BaseOutboxJobPayload>[];
};

export class OutboxDispatcher {
  private static readonly ORDER_TYPES = new Set<OutboxType>([
    OutboxType.ORDER_PROCESS,
    OutboxType.ORDER_CANCEL,
    OutboxType.ORDER_REFUND,
  ]);

  private static readonly PAYMENT_TYPES = new Set<OutboxType>([
    OutboxType.PAYMENT_CREATE_CUSTOMER,
    OutboxType.PAYMENT_UPDATE_CUSTOMER,
    OutboxType.PAYMENT_DELETE_CUSTOMER,
  ]);

  private static readonly EFFECTS_TYPES = new Set<OutboxType>([
    OutboxType.EFFECTS_NOTIFY_USER,
  ]);

  static partition(messages: Outbox[]): OutboxDispatchPlan {
    return {
      orderQueueMsg: messages
        .filter((message) => OutboxDispatcher.ORDER_TYPES.has(message.type))
        .map((message) => OutboxDispatcher.toQueueJob(message)),
      paymentQueueMsg: messages
        .filter((message) => OutboxDispatcher.PAYMENT_TYPES.has(message.type))
        .map((message) => OutboxDispatcher.toQueueJob(message)),
      effectQueueMsg: messages
        .filter((message) => OutboxDispatcher.EFFECTS_TYPES.has(message.type))
        .map((message) => OutboxDispatcher.toQueueJob(message)),
    };
  }

  private static toQueueJob(message: Outbox): QueueJob<BaseOutboxJobPayload> {
    return {
      name: message.type,
      data: message.payload,
      opts: {
        jobId: message.id,
      },
    };
  }
}
