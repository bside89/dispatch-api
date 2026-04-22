import Stripe from 'stripe';

export abstract class BaseStripeAdapter {
  constructor(protected readonly stripe: Stripe.Stripe) {}
}
