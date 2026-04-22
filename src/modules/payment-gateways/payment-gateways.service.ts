import { BaseService } from '@/shared/services/base.service';
import { Injectable } from '@nestjs/common';
import { StripeCustomersAdapter } from './gateways/stripe/adapters/stripe-customers.adapter';
import { StripePaymentIntentsAdapter } from './gateways/stripe/adapters/stripe-payment-intents.adapter';
import {
  GatewayCreateCustomerDto,
  GatewayUpdateCustomerDto,
} from './dto/gateway-customer.dto';
import { IPaymentGatewaysService } from './interfaces/payment-gateways-service.interface';
import { GatewayCustomerResponseDto } from './dto/gateway-customer-response.dto';
import { GatewayPaymentResponseDto } from './dto/gateway-payment-response.dto';
import { PaymentEventType } from './enums/payment-event-type.enum';
import { PaymentWebhookEvent } from './interfaces/payment-webhook-event.interface';
import { StripeRefundsAdapter } from './gateways/stripe/adapters/stripe-refunds.adapter';
import { PaymentGatewayParams } from './interfaces/payment-gateways-params.interface';
import { StripeWebhooksAdapter } from './gateways/stripe/adapters/stripe-webhooks.adapter';
import { StripeCustomerMapper } from './gateways/stripe/helpers/stripe-customer-mapper.helper';
import { StripePaymentIntentMapper } from './gateways/stripe/helpers/stripe-payment-intent-mapper.helper';

@Injectable()
export class PaymentGatewaysService
  extends BaseService
  implements IPaymentGatewaysService
{
  constructor(
    private readonly stripeCustomersAdapter: StripeCustomersAdapter,
    private readonly stripePaymentIntentsAdapter: StripePaymentIntentsAdapter,
    private readonly stripeRefundsAdapter: StripeRefundsAdapter,
    private readonly stripeWebhooksAdapter: StripeWebhooksAdapter,
  ) {
    super(PaymentGatewaysService.name);
  }

  //#region Customers

  public readonly customers = {
    create: async (
      dto: GatewayCreateCustomerDto,
      idempotencyKey: string,
    ): Promise<GatewayCustomerResponseDto> => {
      const stripeDto = StripeCustomerMapper.toStripeCreateCustomerDto(dto);
      return this.stripeCustomersAdapter.create(stripeDto, idempotencyKey);
    },

    list: async (): Promise<GatewayCustomerResponseDto[]> => {
      return this.stripeCustomersAdapter.list();
    },

    retrieve: async (customerId: string): Promise<GatewayCustomerResponseDto> => {
      return this.stripeCustomersAdapter.retrieve(customerId);
    },

    update: async (
      customerId: string,
      dto: GatewayUpdateCustomerDto,
      idempotencyKey: string,
    ): Promise<GatewayCustomerResponseDto> => {
      const stripeDto = StripeCustomerMapper.toStripeUpdateCustomerDto(dto);
      return this.stripeCustomersAdapter.update(
        customerId,
        stripeDto,
        idempotencyKey,
      );
    },

    delete: async (customerId: string, idempotencyKey: string): Promise<void> => {
      await this.stripeCustomersAdapter.delete(customerId, idempotencyKey);
    },
  };

  //#endregion

  //#region Payments

  public readonly payments = {
    create: async (
      params: PaymentGatewayParams,
      idempotencyKey: string,
    ): Promise<GatewayPaymentResponseDto> => {
      const stripeParams =
        StripePaymentIntentMapper.toStripePaymentIntentParams(params);
      return this.stripePaymentIntentsAdapter.create(stripeParams, idempotencyKey);
    },

    retrieve: async (
      paymentIntentId: string,
    ): Promise<GatewayPaymentResponseDto> => {
      return this.stripePaymentIntentsAdapter.retrieve(paymentIntentId);
    },
  };

  //#endregion

  //#region Refunds

  public readonly refunds = {
    create: async (
      paymentIntentId: string,
      amount: number,
      idempotencyKey?: string,
    ): Promise<void> => {
      await this.stripeRefundsAdapter.create(
        paymentIntentId,
        amount,
        'requested_by_customer',
        idempotencyKey,
      );
    },

    retrieve: async (refundId: string): Promise<void> => {
      await this.stripeRefundsAdapter.retrieve(refundId);
    },
  };

  //#endregion

  //#region Webhooks

  public readonly webhooks = {
    constructWebhookEvent: (
      payload: Buffer | string,
      signature: string,
    ): PaymentWebhookEvent => {
      const stripeEvent = this.stripeWebhooksAdapter.constructWebhookEvent(
        payload,
        signature,
      );
      return {
        type: this.toPaymentEventType(stripeEvent.type),
        data: {
          externalId: stripeEvent.data.object.id,
          status: stripeEvent.data.object.status,
          metadata: stripeEvent.data.object.metadata,
        },
      };
    },
  };

  //#endregion

  //#region Private methods

  private toPaymentEventType(stripeType: string): PaymentEventType {
    const map: Record<string, PaymentEventType> = {
      'payment_intent.succeeded': PaymentEventType.PAYMENT_SUCCEEDED,
      'payment_intent.payment_failed': PaymentEventType.PAYMENT_FAILED,
    };
    return map[stripeType] ?? PaymentEventType.UNKNOWN;
  }

  //#endregion
}
