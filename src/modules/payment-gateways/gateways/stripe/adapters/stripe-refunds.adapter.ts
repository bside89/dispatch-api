import { STRIPE_CLIENT } from '../../../constants/stripe-client.token';
import { Injectable, Inject } from '@nestjs/common';
import Stripe from 'stripe';
import {
  StripeRefundReason,
  StripeRefundResponse,
  StripeRefundRetrieveResponse,
} from '../types/stripe-refund.type';
import { BaseStripeAdapter } from './base-stripe.adapter';

@Injectable()
export class StripeRefundsAdapter extends BaseStripeAdapter {
  constructor(@Inject(STRIPE_CLIENT) stripe: Stripe.Stripe) {
    super(stripe);
  }

  async create(
    paymentIntentId: string,
    amount: number,
    reason?: StripeRefundReason,
    idempotencyKey?: string,
  ): Promise<StripeRefundResponse> {
    return this.stripe.refunds.create(
      {
        payment_intent: paymentIntentId,
        amount,
        reason,
      },
      {
        idempotencyKey,
      },
    );
  }

  async retrieve(refundId: string): Promise<StripeRefundRetrieveResponse> {
    return this.stripe.refunds.retrieve(refundId);
  }
}
