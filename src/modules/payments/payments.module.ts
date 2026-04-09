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
import { PaymentsGatewayModule } from '../payments-gateway/payments-gateway.module';

@Module({
  imports: [UsersModule, OrdersModule, PaymentsGatewayModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentsProcessor,
    PaymentJobHandlerFactory,
    CreateCustomerJobStrategy,
    UpdateCustomerJobStrategy,
    DeleteCustomerJobStrategy,
  ],
})
export class PaymentsModule {}
