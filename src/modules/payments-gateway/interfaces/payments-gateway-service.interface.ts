import {
  GatewayCreateCustomerDto,
  GatewayUpdateCustomerDto,
} from '../dto/gateway-customer.dto';
import { GatewayCustomerResponseDto } from '../dto/gateway-customer-response.dto';
import { GatewayPaymentResponseDto } from '../dto/gateway-payment-response.dto';
import { GatewayPaymentIntentParams } from '../types/payment-intent.types';
import { IBaseService } from '@/shared/services/base-service.interface';
import { PaymentWebhookEvent } from '../types/payment-webhook-event.types';

export interface IPaymentsGatewayService extends IBaseService {
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

  paymentIntentsCreate(
    params: GatewayPaymentIntentParams,
    idempotencyKey: string,
  ): Promise<GatewayPaymentResponseDto>;

  paymentIntentsRetrieve(
    paymentIntentId: string,
  ): Promise<GatewayPaymentResponseDto>;

  constructWebhookEvent(
    payload: Buffer | string,
    signature: string,
  ): PaymentWebhookEvent;
}
