import { PaymentEventType } from '../enums/payment-event-type.enum';

export interface PaymentWebhookEventData {
  externalId: string;
  status: string;
  metadata?: Record<string, string>;
}

export interface PaymentWebhookEvent {
  type: PaymentEventType;
  data: PaymentWebhookEventData;
}
