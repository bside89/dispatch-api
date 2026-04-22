import { Inject, Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { STRIPE_CLIENT } from '../../../constants/stripe-client.token';
import { StripePaymentIntentCreateParams } from '../types/stripe-payment-intent.type';
import { BaseStripeAdapter } from './base-stripe.adapter';
import { EntityMapper } from '@/shared/utils/entity-mapper.utils';
import { GatewayPaymentResponseDto } from '@/modules/payment-gateways/dto/gateway-payment-response.dto';

@Injectable()
export class StripePaymentIntentsAdapter extends BaseStripeAdapter {
  constructor(@Inject(STRIPE_CLIENT) stripe: Stripe.Stripe) {
    super(stripe);
  }

  async create(
    params: StripePaymentIntentCreateParams,
    idempotencyKey: string,
  ): Promise<GatewayPaymentResponseDto> {
    const paymentIntent = await this.stripe.paymentIntents.create(params, {
      idempotencyKey,
    });
    return EntityMapper.map(paymentIntent, GatewayPaymentResponseDto);
  }

  async retrieve(paymentIntentId: string): Promise<GatewayPaymentResponseDto> {
    const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
    return EntityMapper.map(paymentIntent, GatewayPaymentResponseDto);
  }
}
