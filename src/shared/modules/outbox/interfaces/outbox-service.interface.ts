import { OutboxType } from '../enums/outbox-type.enum';
import { OutboxPayloadMap } from '../types/outbox-payload.map';

export interface IOutboxService {
  add<T extends OutboxType>(type: T, payload: OutboxPayloadMap[T]): Promise<void>;
}
