import {
  GatewayCreateCustomerDto,
  GatewayUpdateCustomerDto,
} from '../dto/gateway-customer.dto';
import { GatewayCustomerResponseDto } from '../dto/gateway-customer-response.dto';
import { GatewayPaymentResponseDto } from '../dto/gateway-payment-response.dto';
import { IBaseService } from '@/shared/services/base-service.interface';
import { PaymentWebhookEvent } from './payment-webhook-event.interface';
import { PaymentGatewayParams } from './payment-gateways-params.interface';

export interface IPaymentGatewaysService extends IBaseService {
  customersCreate(
    dto: GatewayCreateCustomerDto,
    idempotencyKey: string,
  ): Promise<GatewayCustomerResponseDto>;

  customersList(): Promise<GatewayCustomerResponseDto[]>;

  customersRetrieve(customerId: string): Promise<GatewayCustomerResponseDto>;

  customersUpdate(
    customerId: string,
    dto: GatewayUpdateCustomerDto,
    idempotencyKey: string,
  ): Promise<GatewayCustomerResponseDto>;

  customersDelete(customerId: string, idempotencyKey: string): Promise<void>;

  paymentsCreate(
    params: PaymentGatewayParams,
    idempotencyKey: string,
  ): Promise<GatewayPaymentResponseDto>;

  paymentsRetrieve(paymentIntentId: string): Promise<GatewayPaymentResponseDto>;

  refundsCreate(
    paymentIntentId: string,
    amount: number,
    idempotencyKey?: string,
  ): Promise<void>;

  refundsRetrieve(refundId: string): Promise<void>;

  constructWebhookEvent(
    payload: Buffer | string,
    signature: string,
  ): PaymentWebhookEvent;
}
