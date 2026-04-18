import { IBaseService } from '@/shared/services/base-service.interface';
import { OutboxType } from '../enums/outbox-type.enum';
import { OutboxPayloadMap } from '../types/outbox-payload.map';

export interface IOutboxService extends IBaseService {
  add<T extends OutboxType>(type: T, payload: OutboxPayloadMap[T]): Promise<void>;
}
