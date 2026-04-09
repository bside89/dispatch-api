import { Module } from '@nestjs/common';
import { PaymentsGatewayService } from './payments-gateway.service';
import { stripeClientProvider } from './providers/stripe-client.provider';
import { StripeCustomersGateway } from './gateways/stripe-customers.gateway';

@Module({
  exports: [PaymentsGatewayService],
  providers: [PaymentsGatewayService, stripeClientProvider, StripeCustomersGateway],
})
export class PaymentsGatewayModule {}
