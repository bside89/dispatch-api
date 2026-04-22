import { Injectable, Inject } from '@nestjs/common';
import Stripe from 'stripe';
import { STRIPE_CLIENT } from '../../../constants/stripe-client.token';
import { StripeWebhookEvent } from '../types/stripe-webhook.type';

@Injectable()
export class StripeWebhooksAdapter {
  constructor(@Inject(STRIPE_CLIENT) private readonly stripe: Stripe.Stripe) {}

  constructWebhookEvent(
    payload: Buffer | string,
    signature: string,
    secret: string,
  ): StripeWebhookEvent {
    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      secret,
    ) as unknown as StripeWebhookEvent;
  }
}
