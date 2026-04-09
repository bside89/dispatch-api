import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripeCustomersGateway } from './gateways/stripe-customers.gateway';
import { stripeClientProvider } from './providers/stripe-client.provider';
import { PaymentsProcessor } from './processors/payments.processor';
import { UsersModule } from '../users/users.module';
import { OrdersModule } from '../orders/orders.module';
import {
  CreateCustomerJobStrategy,
  DeleteCustomerJobStrategy,
  UpdateCustomerJobStrategy,
} from './strategies';
import { PaymentJobHandlerFactory } from './factories/payment-job-handler.factory';

@Module({
  imports: [UsersModule, OrdersModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    StripeCustomersGateway,
    stripeClientProvider,
    PaymentsProcessor,
    PaymentJobHandlerFactory,
    CreateCustomerJobStrategy,
    UpdateCustomerJobStrategy,
    DeleteCustomerJobStrategy,
  ],
})
export class PaymentsModule {}
