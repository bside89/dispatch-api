import { PaymentGatewayParams } from '@/modules/payment-gateways/interfaces/payment-gateways-params.interface';
import { StripePaymentIntentCreateParams } from '../types/stripe-payment-intent.type';

export class StripePaymentIntentMapper {
  static toStripePaymentIntentParams(
    params: PaymentGatewayParams,
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
}
