import { Outbox } from '../entities/outbox.entity';
import { OutboxType } from '../enums/outbox-type.enum';
import { QueueJob } from '@/shared/interfaces/queue-job.interface';
import { BaseOutboxJobPayload } from '../payloads/outbox.payload';
import { EventBusJob } from '../../events/interfaces/event-bus-job.interface';

type OutboxDispatchPlan = {
  orderQueueMsg: QueueJob<BaseOutboxJobPayload>[];
  paymentQueueMsg: QueueJob<BaseOutboxJobPayload>[];
  eventBusMsg: EventBusJob<BaseOutboxJobPayload>[];
};

const ORDER_TYPES = new Set<OutboxType>([
  OutboxType.ORDER_PROCESS,
  OutboxType.ORDER_CANCEL,
  OutboxType.ORDER_REFUND,
]);

const PAYMENT_TYPES = new Set<OutboxType>([
  OutboxType.PAYMENT_CREATE_CUSTOMER,
  OutboxType.PAYMENT_UPDATE_CUSTOMER,
  OutboxType.PAYMENT_DELETE_CUSTOMER,
]);

export class OutboxDispatcher {
  partition(messages: Outbox[]): OutboxDispatchPlan {
    return {
      orderQueueMsg: messages
        .filter((message) => ORDER_TYPES.has(message.type))
        .map((message) => this.toQueueJob(message)),
      paymentQueueMsg: messages
        .filter((message) => PAYMENT_TYPES.has(message.type))
        .map((message) => this.toQueueJob(message)),
      eventBusMsg: messages
        .filter((message) => message.type === OutboxType.EVENTS_NOTIFY_USER)
        .map((message) => this.toEventBusJob(message)),
    };
  }

  private toQueueJob(message: Outbox): QueueJob<BaseOutboxJobPayload> {
    return {
      name: message.type,
      data: message.payload,
      opts: {
        jobId: message.id,
      },
    };
  }

  private toEventBusJob(message: Outbox): EventBusJob<BaseOutboxJobPayload> {
    return {
      job: this.toQueueJob(message),
    };
  }
}
