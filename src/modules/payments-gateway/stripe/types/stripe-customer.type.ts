import Stripe from 'stripe';

export type StripeCustomerTaxExempt = 'exempt' | 'none' | 'reverse';

export type StripeCustomerTaxValidateLocation = 'deferred' | 'immediately';

export type StripeCustomerCashBalanceReconciliationMode =
  | 'automatic'
  | 'manual'
  | 'merchant_default';

export type StripeCustomerInvoiceAmountTaxDisplay =
  | 'exclude_tax'
  | 'include_inclusive_tax';

export type StripeCustomerTaxIdType = string;

export interface StripePaymentCustomerAddress {
  city?: string | null;
  country?: string | null;
  line1?: string | null;
  line2?: string | null;
  postalCode?: string | null;
  state?: string | null;
}

export interface StripePaymentCustomerShipping {
  address?: StripePaymentCustomerAddress | null;
  name: string;
  phone?: string | null;
}

export interface StripePaymentCustomerTaxId {
  id: string;
  type: StripeCustomerTaxIdType;
  value: string;
}

export interface StripePaymentCustomer {
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
  taxExempt?: StripeCustomerTaxExempt | null;
  address?: StripePaymentCustomerAddress | null;
  shipping?: StripePaymentCustomerShipping | null;
  taxIds: StripePaymentCustomerTaxId[];
  createdAt: Date;
  livemode: boolean;
}

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

export type StripeDeletedCustomer = Extract<
  StripeCustomerResponse,
  { deleted: true }
>;

export type StripeCustomer = Exclude<StripeCustomerResponse, StripeDeletedCustomer>;

export type StripeCustomerCreateTaxIdType = NonNullable<
  StripeCustomerCreateParams['tax_id_data']
>[number]['type'];
