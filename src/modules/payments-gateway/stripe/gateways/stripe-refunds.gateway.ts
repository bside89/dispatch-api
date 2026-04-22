import { BaseService } from '@/shared/services/base.service';
import { STRIPE_CLIENT } from '../../constants/stripe-client.token';
import { Injectable, Inject } from '@nestjs/common';
import Stripe from 'stripe';
import {
  StripeRefundReason,
  StripeRefundResponse,
  StripeRefundRetrieveResponse,
} from '../types/stripe-refund.type';

@Injectable()
export class StripeRefundsGateway extends BaseService {
  constructor(@Inject(STRIPE_CLIENT) private readonly stripe: Stripe.Stripe) {
    super(StripeRefundsGateway.name);
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
