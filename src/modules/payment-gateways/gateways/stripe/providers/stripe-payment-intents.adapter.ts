import { Inject, Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { STRIPE_CLIENT } from '../../../constants/stripe-client.token';
import {
  StripePaymentIntentCreateParams,
  StripePaymentIntentResponse,
} from '../types/stripe-payment-intent.type';

@Injectable()
export class StripePaymentIntentsAdapter {
  constructor(@Inject(STRIPE_CLIENT) private readonly stripe: Stripe.Stripe) {}

  async create(
    params: StripePaymentIntentCreateParams,
    idempotencyKey: string,
  ): Promise<StripePaymentIntentResponse> {
    return this.stripe.paymentIntents.create(params, { idempotencyKey });
  }

  async retrieve(paymentIntentId: string): Promise<StripePaymentIntentResponse> {
    return this.stripe.paymentIntents.retrieve(paymentIntentId);
  }
}
