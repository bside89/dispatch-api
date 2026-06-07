export class PaymentResponseDto {
  id: string;

  orderId: string;

  userId: string;

  stripePaymentIntentId: string;

  stripeClientSecret: string;

  status: string;
}
