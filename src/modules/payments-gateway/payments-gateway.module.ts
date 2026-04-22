import { Module } from '@nestjs/common';
import { PaymentsGatewayService } from './payments-gateway.service';
import { StripeCustomersGateway } from './stripe/gateways/stripe-customers.gateway';
import { StripePaymentIntentsGateway } from './stripe/gateways/stripe-payment-intents.gateway';
import { StripeRefundsGateway } from './stripe/gateways/stripe-refunds.gateway';
import { StripeWebhooksGateway } from './stripe/gateways/stripe-webhooks.gateway';
import { PAYMENTS_GATEWAY_SERVICE } from './constants/payments-gateway.token';
import { stripeClient } from '@/config/stripe.config';
import { STRIPE_CLIENT } from './constants/stripe-client.token';
import { ConfigService } from '@nestjs/config';

@Module({
  exports: [PAYMENTS_GATEWAY_SERVICE],
  providers: [
    { provide: PAYMENTS_GATEWAY_SERVICE, useClass: PaymentsGatewayService },
    {
      provide: STRIPE_CLIENT,
      useFactory: stripeClient,
      inject: [ConfigService],
    },
    StripeCustomersGateway,
    StripePaymentIntentsGateway,
    StripeRefundsGateway,
    StripeWebhooksGateway,
  ],
})
export class PaymentsGatewayModule {}
