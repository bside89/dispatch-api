import Stripe from 'stripe';

/**
 * Derive Stripe types from the public client API to avoid leaking internal SDK
 * paths. For new methods, prefer Awaited<ReturnType<...>> and narrow union responses
 * explicitly
 * */

//#region Stripe Payment Intent Types

export type StripePaymentIntentCreateParams = Parameters<
  Stripe.Stripe['paymentIntents']['create']
>[0];

export type StripePaymentIntentResponse = Awaited<
  ReturnType<Stripe.Stripe['paymentIntents']['retrieve']>
>;

//#endregion

//#region Stripe Webhook Types

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

//#endregion
