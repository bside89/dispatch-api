import { IBaseService } from '@/shared/services/base-service.interface';

export interface IPaymentsService extends IBaseService {
  processWebhookEvent(payload: Buffer | string, signature: string): Promise<void>;
}
