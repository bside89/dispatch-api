import Stripe from 'stripe';

//#region General Customer Types

export type CustomerTaxExempt = 'exempt' | 'none' | 'reverse';

export type CustomerTaxValidateLocation = 'deferred' | 'immediately';

export type CustomerCashBalanceReconciliationMode =
  | 'automatic'
  | 'manual'
  | 'merchant_default';

export type CustomerInvoiceAmountTaxDisplay =
  | 'exclude_tax'
  | 'include_inclusive_tax';

export type CustomerTaxIdType = string;

export interface PaymentCustomerAddress {
  city?: string | null;
  country?: string | null;
  line1?: string | null;
  line2?: string | null;
  postalCode?: string | null;
  state?: string | null;
}

export interface PaymentCustomerShipping {
  address?: PaymentCustomerAddress | null;
  name: string;
  phone?: string | null;
}

export interface PaymentCustomerTaxId {
  id: string;
  type: string;
  value: string;
}

export interface PaymentCustomer {
  id: string;
  email: string | null;
  name: string | null;
  businessName?: string | null;
  individualName?: string | null;
  phone?: string | null;
  description: string | null;
  balance: number;
  invoicePrefix?: string | null;
  defaultPaymentMethodId?: string | null;
  preferredLocales: string[];
  metadata: Record<string, string>;
  taxExempt?: CustomerTaxExempt | null;
  address?: PaymentCustomerAddress | null;
  shipping?: PaymentCustomerShipping | null;
  taxIds: PaymentCustomerTaxId[];
  createdAt: Date;
  livemode: boolean;
}

//#endregion

//#region Stripe Customer Types

/**
 * Derive Stripe types from the public client API to avoid leaking internal SDK
 * paths. For new methods, prefer Awaited<ReturnType<...>> and narrow union responses
 * explicitly
 * */

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

//#endregion
