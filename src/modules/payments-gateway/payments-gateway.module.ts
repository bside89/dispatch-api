import { Module } from '@nestjs/common';
import { PaymentsGatewayService } from './payments-gateway.service';
import { stripeClientProvider } from './providers/stripe-client.provider';
import { StripeCustomersGateway } from './gateways/stripe-customers.gateway';
import { StripePaymentIntentsGateway } from './gateways/stripe-payment-intents.gateway';

@Module({
  exports: [PaymentsGatewayService],
  providers: [
    PaymentsGatewayService,
    stripeClientProvider,
    StripeCustomersGateway,
    StripePaymentIntentsGateway,
  ],
})
export class PaymentsGatewayModule {}
