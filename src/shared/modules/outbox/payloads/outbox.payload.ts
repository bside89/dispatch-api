import { BaseJobPayload } from '@/shared/payloads/base-job.payload';
import { OutboxType } from '../enums/outbox-type.enum';

export abstract class BaseOutboxJobPayload extends BaseJobPayload {
  abstract readonly type: OutboxType;
}
