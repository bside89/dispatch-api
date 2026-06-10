import { IBaseService } from '@/shared/providers/services/base-service.interface';
import { BaseOutboxJobPayload } from '../payloads/outbox.payload';

export interface IOutboxService extends IBaseService {
  add<T extends BaseOutboxJobPayload>(outboxPayload: T): Promise<void>;
}
