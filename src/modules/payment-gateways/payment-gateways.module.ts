import { Module } from '@nestjs/common';
import { PaymentGatewaysService } from './payment-gateways.service';
import { StripeCustomersAdapter } from './gateways/stripe/adapters/stripe-customers.adapter';
import { StripePaymentIntentsAdapter } from './gateways/stripe/adapters/stripe-payment-intents.adapter';
import { StripeRefundsAdapter } from './gateways/stripe/adapters/stripe-refunds.adapter';
import { StripeWebhooksAdapter } from './gateways/stripe/adapters/stripe-webhooks.adapter';
import { PAYMENTS_GATEWAY_SERVICE } from './constants/payments-gateway.token';
import { stripeClient } from '@/config/stripe.config';
import { STRIPE_CLIENT } from './constants/stripe-client.token';
import { ConfigService } from '@nestjs/config';

@Module({
  exports: [PAYMENTS_GATEWAY_SERVICE],
  providers: [
    { provide: PAYMENTS_GATEWAY_SERVICE, useClass: PaymentGatewaysService },
    {
      provide: STRIPE_CLIENT,
      useFactory: stripeClient,
      inject: [ConfigService],
    },
    StripeCustomersAdapter,
    StripePaymentIntentsAdapter,
    StripeRefundsAdapter,
    StripeWebhooksAdapter,
  ],
})
export class PaymentGatewaysModule {}
