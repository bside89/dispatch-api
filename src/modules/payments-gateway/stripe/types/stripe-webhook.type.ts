export interface StripeWebhookObject {
  id: string;
  status: string;
  metadata?: Record<string, string>;
}

export interface StripeWebhookEvent {
  type: string;
  data: {
    object: StripeWebhookObject;
  };
}
