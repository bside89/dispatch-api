import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsProcessor } from './processors/payments.processor';
import { UsersModule } from '../users/users.module';
import { OrdersModule } from '../orders/orders.module';
import {
  CreateCustomerJobStrategy,
  DeleteCustomerJobStrategy,
  UpdateCustomerJobStrategy,
} from './strategies';
import { PaymentJobHandlerFactory } from './factories/payment-job-handler.factory';
import { PaymentGatewaysModule } from '../payment-gateways/payment-gateways.module';
import { PAYMENTS_SERVICE } from './constants/payments.token';

@Module({
  imports: [UsersModule, OrdersModule, PaymentGatewaysModule],
  controllers: [PaymentsController],
  providers: [
    { provide: PAYMENTS_SERVICE, useClass: PaymentsService },
    PaymentsProcessor,
    PaymentJobHandlerFactory,
    CreateCustomerJobStrategy,
    UpdateCustomerJobStrategy,
    DeleteCustomerJobStrategy,
  ],
})
export class PaymentsModule {}
