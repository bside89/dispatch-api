import { BaseService } from '@/shared/services/base.service';
import { Injectable } from '@nestjs/common';
import { StripeCustomersGateway } from './gateways/stripe-customers.gateway';
import { StripePaymentIntentsGateway } from './gateways/stripe-payment-intents.gateway';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CustomerResponseDto } from './dto/customer-response.dto';
import { EntityMapper } from '@/shared/utils/entity-mapper';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { PaymentIntentResponseDto } from './dto/payment-intent-response.dto';
import {
  StripePaymentIntentCreateParams,
  StripeWebhookEvent,
} from './types/payment-intent.types';

@Injectable()
export class PaymentsGatewayService extends BaseService {
  constructor(
    private readonly stripeCustomersGateway: StripeCustomersGateway,
    private readonly stripePaymentIntentsGateway: StripePaymentIntentsGateway,
  ) {
    super(PaymentsGatewayService.name);
  }

  //#region Customers

  async customersCreate(
    dto: CreateCustomerDto,
    idempotencyKey: string,
  ): Promise<CustomerResponseDto> {
    const customer = await this.stripeCustomersGateway.create(dto, idempotencyKey);
    return EntityMapper.map(customer, CustomerResponseDto);
  }

  async customersList(): Promise<CustomerResponseDto[]> {
    const customers = await this.stripeCustomersGateway.list();
    return EntityMapper.mapArray(customers, CustomerResponseDto);
  }

  async customersRetrieve(customerId: string): Promise<CustomerResponseDto> {
    const customer = await this.stripeCustomersGateway.retrieve(customerId);
    return EntityMapper.map(customer, CustomerResponseDto);
  }

  async customersUpdate(
    customerId: string,
    dto: UpdateCustomerDto,
    idempotencyKey: string,
  ): Promise<CustomerResponseDto> {
    const updatedCustomer = await this.stripeCustomersGateway.update(
      customerId,
      dto,
      idempotencyKey,
    );
    return EntityMapper.map(updatedCustomer, CustomerResponseDto);
  }

  async customersDelete(customerId: string, idempotencyKey: string): Promise<void> {
    await this.stripeCustomersGateway.delete(customerId, idempotencyKey);
  }

  //#endregion

  //#region Payment Intents

  async paymentIntentsCreate(
    params: StripePaymentIntentCreateParams,
    idempotencyKey: string,
  ): Promise<PaymentIntentResponseDto> {
    const paymentIntent = await this.stripePaymentIntentsGateway.create(
      params,
      idempotencyKey,
    );
    const mapped = EntityMapper.map(paymentIntent, PaymentIntentResponseDto);
    mapped.metadata = paymentIntent.metadata;
    return mapped;
  }

  async paymentIntentsRetrieve(
    paymentIntentId: string,
  ): Promise<PaymentIntentResponseDto> {
    const paymentIntent =
      await this.stripePaymentIntentsGateway.retrieve(paymentIntentId);
    const mapped = EntityMapper.map(paymentIntent, PaymentIntentResponseDto);
    mapped.metadata = paymentIntent.metadata;
    return mapped;
  }

  constructWebhookEvent(
    payload: Buffer | string,
    signature: string,
    secret: string,
  ): StripeWebhookEvent {
    return this.stripePaymentIntentsGateway.constructWebhookEvent(
      payload,
      signature,
      secret,
    );
  }

  //#endregion
}
