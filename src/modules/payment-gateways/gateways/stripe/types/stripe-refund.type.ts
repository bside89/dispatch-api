import Stripe from 'stripe';

export type StripeRefundResponse = Awaited<
  ReturnType<Stripe.Stripe['refunds']['create']>
>;

export type StripeRefundRetrieveResponse = Awaited<
  ReturnType<Stripe.Stripe['refunds']['retrieve']>
>;

export type StripeRefundReason =
  | 'duplicate'
  | 'fraudulent'
  | 'requested_by_customer';
