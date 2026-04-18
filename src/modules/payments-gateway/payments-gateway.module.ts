import { Module } from '@nestjs/common';
import { PaymentsGatewayService } from './payments-gateway.service';
import { stripeClientProvider } from './providers/stripe-client.provider';
import { StripeCustomersGateway } from './gateways/stripe-customers.gateway';
import { StripePaymentIntentsGateway } from './gateways/stripe-payment-intents.gateway';
import { PAYMENTS_GATEWAY_SERVICE } from './constants/payments-gateway.tokens';

@Module({
  exports: [PAYMENTS_GATEWAY_SERVICE],
  providers: [
    { provide: PAYMENTS_GATEWAY_SERVICE, useClass: PaymentsGatewayService },
    stripeClientProvider,
    StripeCustomersGateway,
    StripePaymentIntentsGateway,
  ],
})
export class PaymentsGatewayModule {}
