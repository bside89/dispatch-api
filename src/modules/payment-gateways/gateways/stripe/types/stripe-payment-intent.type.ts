import Stripe from 'stripe';

export type StripePaymentIntentCreateParams = Parameters<
  Stripe.Stripe['paymentIntents']['create']
>[0];

export type StripePaymentIntentResponse = Awaited<
  ReturnType<Stripe.Stripe['paymentIntents']['retrieve']>
>;
