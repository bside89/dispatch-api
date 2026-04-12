import { Inject, Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { BaseService } from '@/shared/services/base.service';
import { STRIPE_CLIENT } from '../constants/stripe-client.token';
import {
  StripePaymentIntentCreateParams,
  StripePaymentIntentResponse,
  StripePaymentIntentWebhookEvent,
} from '../types/payment-intent.types';

@Injectable()
export class StripePaymentIntentsGateway extends BaseService {
  constructor(@Inject(STRIPE_CLIENT) private readonly stripe: Stripe.Stripe) {
    super(StripePaymentIntentsGateway.name);
  }

  async create(
    params: StripePaymentIntentCreateParams,
    idempotencyKey: string,
  ): Promise<StripePaymentIntentResponse> {
    return this.stripe.paymentIntents.create(params, { idempotencyKey });
  }

  async retrieve(paymentIntentId: string): Promise<StripePaymentIntentResponse> {
    return this.stripe.paymentIntents.retrieve(paymentIntentId);
  }

  constructWebhookEvent(
    payload: Buffer | string,
    signature: string,
    secret: string,
  ): StripePaymentIntentWebhookEvent {
    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      secret,
    ) as unknown as StripePaymentIntentWebhookEvent;
  }
}
