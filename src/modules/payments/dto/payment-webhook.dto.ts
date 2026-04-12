import { ApiProperty } from '@nestjs/swagger';

export class PaymentWebhookDto {
  @ApiProperty({
    description: 'Stripe event type',
    example: 'payment_intent.succeeded',
  })
  type: string;
}
