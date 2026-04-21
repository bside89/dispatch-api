import { BaseService } from '@/shared/services/base.service';
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StripeCustomersGateway } from './gateways/stripe-customers.gateway';
import { StripePaymentIntentsGateway } from './gateways/stripe-payment-intents.gateway';
import {
  StripeCreateCustomerAddressDto,
  StripeCreateCustomerDto,
} from './dto/stripe-customer.dto';
import {
  GatewayCreateCustomerDto,
  GatewayUpdateCustomerDto,
} from './dto/gateway-customer.dto';
import { IPaymentsGatewayService } from './interfaces/payments-gateway-service.interface';
import { GatewayCustomerResponseDto } from './dto/gateway-customer-response.dto';
import { EntityMapper } from '@/shared/utils/entity-mapper.utils';
import {
  StripeUpdateCustomerAddressDto,
  StripeUpdateCustomerDto,
} from './dto/stripe-customer.dto';
import { GatewayPaymentResponseDto } from './dto/gateway-payment-response.dto';
import {
  GatewayPaymentIntentParams,
  StripePaymentIntentCreateParams,
} from './types/payment-intent.types';
import { PaymentEventType } from './enums/payment-event-type.enum';
import { PaymentWebhookEvent } from './types/payment-webhook-event.types';

@Injectable()
export class PaymentsGatewayService
  extends BaseService
  implements IPaymentsGatewayService, OnApplicationBootstrap
{
  private webhookSecret: string;

  constructor(
    private readonly stripeCustomersGateway: StripeCustomersGateway,
    private readonly stripePaymentIntentsGateway: StripePaymentIntentsGateway,
    private readonly configService: ConfigService,
  ) {
    super(PaymentsGatewayService.name);
  }

  onApplicationBootstrap() {
    this.webhookSecret = this.configService.getOrThrow<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
  }

  //#region Customers

  async customersCreate(
    dto: GatewayCreateCustomerDto,
    idempotencyKey: string,
  ): Promise<GatewayCustomerResponseDto> {
    const stripeDto = this.toStripeCreateCustomerDto(dto);
    const customer = await this.stripeCustomersGateway.create(
      stripeDto,
      idempotencyKey,
    );
    return EntityMapper.map(customer, GatewayCustomerResponseDto);
  }

  async customersList(): Promise<GatewayCustomerResponseDto[]> {
    const customers = await this.stripeCustomersGateway.list();
    return EntityMapper.mapArray(customers, GatewayCustomerResponseDto);
  }

  async customersRetrieve(customerId: string): Promise<GatewayCustomerResponseDto> {
    const customer = await this.stripeCustomersGateway.retrieve(customerId);
    return EntityMapper.map(customer, GatewayCustomerResponseDto);
  }

  async customersUpdate(
    customerId: string,
    dto: GatewayUpdateCustomerDto,
    idempotencyKey: string,
  ): Promise<GatewayCustomerResponseDto> {
    const stripeDto = this.toStripeUpdateCustomerDto(dto);
    const updatedCustomer = await this.stripeCustomersGateway.update(
      customerId,
      stripeDto,
      idempotencyKey,
    );
    return EntityMapper.map(updatedCustomer, GatewayCustomerResponseDto);
  }

  async customersDelete(customerId: string, idempotencyKey: string): Promise<void> {
    await this.stripeCustomersGateway.delete(customerId, idempotencyKey);
  }

  //#endregion

  //#region Payment Intents

  async paymentIntentsCreate(
    params: GatewayPaymentIntentParams,
    idempotencyKey: string,
  ): Promise<GatewayPaymentResponseDto> {
    const stripeParams = this.toStripePaymentIntentParams(params);
    const paymentIntent = await this.stripePaymentIntentsGateway.create(
      stripeParams,
      idempotencyKey,
    );
    const mapped = EntityMapper.map(paymentIntent, GatewayPaymentResponseDto);
    return mapped;
  }

  async paymentIntentsRetrieve(
    paymentIntentId: string,
  ): Promise<GatewayPaymentResponseDto> {
    const paymentIntent =
      await this.stripePaymentIntentsGateway.retrieve(paymentIntentId);
    const mapped = EntityMapper.map(paymentIntent, GatewayPaymentResponseDto);
    return mapped;
  }

  constructWebhookEvent(
    payload: Buffer | string,
    signature: string,
  ): PaymentWebhookEvent {
    const stripeEvent = this.stripePaymentIntentsGateway.constructWebhookEvent(
      payload,
      signature,
      this.webhookSecret,
    );
    return {
      type: this.toPaymentEventType(stripeEvent.type),
      data: {
        externalId: stripeEvent.data.object.id,
        status: stripeEvent.data.object.status,
        metadata: stripeEvent.data.object.metadata,
      },
    };
  }

  //#endregion

  private toStripeCreateCustomerDto(
    dto: GatewayCreateCustomerDto,
  ): StripeCreateCustomerDto {
    const result = new StripeCreateCustomerDto();
    result.email = dto.email;
    result.name = dto.name;
    if (dto.address) {
      const addr = new StripeCreateCustomerAddressDto();
      Object.assign(addr, dto.address);
      result.address = addr;
    }
    result.metadata = dto.metadata;
    return result;
  }

  private toStripeUpdateCustomerDto(
    dto: GatewayUpdateCustomerDto,
  ): StripeUpdateCustomerDto {
    const result = new StripeUpdateCustomerDto();
    if (dto.email !== undefined) result.email = dto.email;
    if (dto.name !== undefined) result.name = dto.name;
    if (dto.address !== undefined) {
      const addr = new StripeUpdateCustomerAddressDto();
      Object.assign(addr, dto.address);
      result.address = addr;
    }
    if (dto.metadata !== undefined) result.metadata = dto.metadata;
    return result;
  }

  private toStripePaymentIntentParams(
    params: GatewayPaymentIntentParams,
  ): StripePaymentIntentCreateParams {
    return {
      amount: params.amount,
      currency: params.currency,
      customer: params.customerId,
      receipt_email: params.receiptEmail,
      confirmation_method: 'automatic',
      automatic_payment_methods: { enabled: true },
      metadata: params.metadata,
    };
  }

  private toPaymentEventType(stripeType: string): PaymentEventType {
    const map: Record<string, PaymentEventType> = {
      'payment_intent.succeeded': PaymentEventType.PAYMENT_SUCCEEDED,
      'payment_intent.payment_failed': PaymentEventType.PAYMENT_FAILED,
    };
    return map[stripeType] ?? PaymentEventType.UNKNOWN;
  }
}
