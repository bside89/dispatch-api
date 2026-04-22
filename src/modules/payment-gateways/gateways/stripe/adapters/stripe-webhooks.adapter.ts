import { Injectable, Inject } from '@nestjs/common';
import Stripe from 'stripe';
import { STRIPE_CLIENT } from '../../../constants/stripe-client.token';
import { StripeWebhookEvent } from '../types/stripe-webhook.type';
import { ConfigService } from '@nestjs/config';
import { BaseStripeAdapter } from './base-stripe.adapter';

@Injectable()
export class StripeWebhooksAdapter extends BaseStripeAdapter {
  private webhookSecret: string;

  constructor(
    @Inject(STRIPE_CLIENT) stripe: Stripe.Stripe,
    private readonly configService: ConfigService,
  ) {
    super(stripe);
    this.webhookSecret = this.configService.getOrThrow<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
  }

  constructWebhookEvent(
    payload: Buffer | string,
    signature: string,
  ): StripeWebhookEvent {
    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      this.webhookSecret,
    ) as unknown as StripeWebhookEvent;
  }
}
