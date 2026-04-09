import Stripe from 'stripe';

// Derive Stripe types from the public client API to avoid leaking internal SDK paths.
// For new methods, prefer Awaited<ReturnType<...>> and narrow union responses explicitly.
export type StripeCustomerCreateParams = Parameters<
  Stripe.Stripe['customers']['create']
>[0];
export type StripeCustomerList = Awaited<
  ReturnType<Stripe.Stripe['customers']['list']>
>['data'];
export type StripeCustomerListItem = StripeCustomerList[number];
export type StripeCustomerResponse = Awaited<
  ReturnType<Stripe.Stripe['customers']['retrieve']>
>;
export type DeletedStripeCustomer = Extract<
  StripeCustomerResponse,
  { deleted: true }
>;
export type StripeCustomer = Exclude<StripeCustomerResponse, DeletedStripeCustomer>;
export type StripeCustomerCreateTaxIdType = NonNullable<
  StripeCustomerCreateParams['tax_id_data']
>[number]['type'];
