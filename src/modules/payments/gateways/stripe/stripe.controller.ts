import { Public } from '@/modules/auth/decorators/public.decorator';
import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  RawBody,
} from '@nestjs/common';
import { StripeAdapter } from './providers/stripe.adapter';

@Controller('stripe')
export class StripeController {
  constructor(private readonly stripeAdapter: StripeAdapter) {}

  @Post('webhook')
  @Public()
  @HttpCode(200)
  async processWebhook(
    @RawBody() rawBody: Buffer,
    @Headers('stripe-signature') signature: string,
  ): Promise<void> {
    if (!signature) {
      throw new BadRequestException("The 'stripe-signature' header is required.");
    }
    return this.stripeAdapter.processWebhook({
      eventType: 'stripe-webhook',
      payload: rawBody,
      signature,
    });
  }
}
