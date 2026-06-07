import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@/shared/modules/cache/cache.module';
import { DbGuardModule } from '@/shared/modules/db-guard/db-guard.module';
import {
  CUSTOMER_REPOSITORY,
  PAYMENT_REPOSITORY,
  PAYMENTS_GATEWAY_ADAPTER,
  PAYMENTS_SERVICE,
  REFUND_REPOSITORY,
} from './constants/payments.token';
import { Customer } from './entities/customer.entity';
import { Payment } from './entities/payment.entity';
import { Refund } from './entities/refund.entity';
import { StripeAdapter } from './gateways/stripe/providers/stripe.adapter';
import { StripeModule } from './gateways/stripe/stripe.module';
import { PaymentsService } from './payments.service';
import { PaymentJobHandlerFactory } from './providers/factories/payment-job-handler.factory';
import { PaymentsProcessor } from './providers/processors/payments.processor';
import { CustomerRepository } from './providers/repositories/customer.repository';
import { PaymentRepository } from './providers/repositories/payment.repository';
import { RefundRepository } from './providers/repositories/refund.repository';
import {
  CreateCustomerJobStrategy,
  DeleteCustomerJobStrategy,
  UpdateCustomerJobStrategy,
} from './providers/strategies';

@Module({
  imports: [
    StripeModule,
    TypeOrmModule.forFeature([Customer, Payment, Refund]),
    CacheModule,
    DbGuardModule,
  ],
  exports: [PAYMENTS_SERVICE, PAYMENTS_GATEWAY_ADAPTER],
  providers: [
    { provide: PAYMENTS_GATEWAY_ADAPTER, useExisting: StripeAdapter },
    { provide: PAYMENTS_SERVICE, useClass: PaymentsService },
    { provide: CUSTOMER_REPOSITORY, useClass: CustomerRepository },
    { provide: PAYMENT_REPOSITORY, useClass: PaymentRepository },
    { provide: REFUND_REPOSITORY, useClass: RefundRepository },
    PaymentsProcessor,
    PaymentJobHandlerFactory,
    CreateCustomerJobStrategy,
    UpdateCustomerJobStrategy,
    DeleteCustomerJobStrategy,
  ],
})
export class PaymentsModule {}
