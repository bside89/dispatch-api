import {
  GatewayCreateCustomerDto,
  GatewayUpdateCustomerDto,
} from '../dto/gateway-customer.dto';
import { GatewayCustomerResponseDto } from '../dto/gateway-customer-response.dto';
import { GatewayPaymentResponseDto } from '../dto/gateway-payment-response.dto';
import { IBaseService } from '@/shared/services/base-service.interface';
import { PaymentWebhookEvent } from './payment-webhook-event.interface';
import { PaymentGatewayParams } from './payment-gateways-params.interface';

interface IPaymentGatewaysCustomers {
  create(
    dto: GatewayCreateCustomerDto,
    idempotencyKey: string,
  ): Promise<GatewayCustomerResponseDto>;

  list(): Promise<GatewayCustomerResponseDto[]>;

  retrieve(customerId: string): Promise<GatewayCustomerResponseDto>;

  update(
    customerId: string,
    dto: GatewayUpdateCustomerDto,
    idempotencyKey: string,
  ): Promise<GatewayCustomerResponseDto>;

  delete(customerId: string, idempotencyKey: string): Promise<void>;
}

interface IPaymentGatewaysPayments {
  create(
    params: PaymentGatewayParams,
    idempotencyKey: string,
  ): Promise<GatewayPaymentResponseDto>;

  retrieve(paymentIntentId: string): Promise<GatewayPaymentResponseDto>;
}

interface IPaymentGatewaysRefunds {
  create(
    paymentIntentId: string,
    amount: number,
    idempotencyKey?: string,
  ): Promise<void>;

  retrieve(refundId: string): Promise<void>;
}

interface IPaymentGatewaysWebhooks {
  constructWebhookEvent(
    payload: Buffer | string,
    signature: string,
  ): PaymentWebhookEvent;
}

export interface IPaymentGatewaysService extends IBaseService {
  customers: IPaymentGatewaysCustomers;

  payments: IPaymentGatewaysPayments;

  refunds: IPaymentGatewaysRefunds;

  webhooks: IPaymentGatewaysWebhooks;
}
