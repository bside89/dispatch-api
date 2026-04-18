import { CreateCustomerDto } from '../dto/create-customer.dto';
import { CustomerResponseDto } from '../dto/customer-response.dto';
import { UpdateCustomerDto } from '../dto/update-customer.dto';
import { PaymentIntentResponseDto } from '../dto/payment-intent-response.dto';
import {
  StripePaymentIntentCreateParams,
  StripeWebhookEvent,
} from '../types/payment-intent.types';

export interface IPaymentsGatewayService {
  customersCreate(
    dto: CreateCustomerDto,
    idempotencyKey: string,
  ): Promise<CustomerResponseDto>;

  customersList(): Promise<CustomerResponseDto[]>;

  customersRetrieve(customerId: string): Promise<CustomerResponseDto>;

  customersUpdate(
    customerId: string,
    dto: UpdateCustomerDto,
    idempotencyKey: string,
  ): Promise<CustomerResponseDto>;

  customersDelete(customerId: string, idempotencyKey: string): Promise<void>;

  paymentIntentsCreate(
    params: StripePaymentIntentCreateParams,
    idempotencyKey: string,
  ): Promise<PaymentIntentResponseDto>;

  paymentIntentsRetrieve(paymentIntentId: string): Promise<PaymentIntentResponseDto>;

  constructWebhookEvent(
    payload: Buffer | string,
    signature: string,
    secret: string,
  ): StripeWebhookEvent;
}
