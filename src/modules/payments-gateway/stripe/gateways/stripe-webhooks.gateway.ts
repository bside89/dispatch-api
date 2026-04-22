import { BaseService } from '@/shared/services/base.service';
import { Injectable, Inject } from '@nestjs/common';
import Stripe from 'stripe';
import { STRIPE_CLIENT } from '../../constants/stripe-client.token';
import { StripeWebhookEvent } from '../types/stripe-webhook.type';

@Injectable()
export class StripeWebhooksGateway extends BaseService {
  constructor(@Inject(STRIPE_CLIENT) private readonly stripe: Stripe.Stripe) {
    super(StripeWebhooksGateway.name);
  }

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
