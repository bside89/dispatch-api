import Stripe from 'stripe';

export type StripePaymentIntentCreateParams = Parameters<
  Stripe.Stripe['paymentIntents']['create']
>[0];

export type StripePaymentIntentResponse = Awaited<
  ReturnType<Stripe.Stripe['paymentIntents']['retrieve']>
>;

export interface StripePaymentIntentWebhookObject {
  id: string;
  status: string;
  metadata?: Record<string, string>;
}

export interface StripePaymentIntentWebhookEvent {
  type: string;
  data: {
    object: StripePaymentIntentWebhookObject;
  };
}
