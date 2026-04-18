import { Module } from '@nestjs/common';
import { PaymentsGatewayService } from './payments-gateway.service';
import { StripeCustomersGateway } from './gateways/stripe-customers.gateway';
import { StripePaymentIntentsGateway } from './gateways/stripe-payment-intents.gateway';
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
  ],
})
export class PaymentsGatewayModule {}
