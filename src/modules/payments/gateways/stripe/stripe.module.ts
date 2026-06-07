import { stripeClient } from '@/modules/payments/gateways/stripe/config/stripe.config';
import { OutboxModule } from '@/shared/modules/outbox/outbox.module';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { STRIPE_CLIENT } from './constants/stripe.token';
import { StripeAdapter } from './providers/stripe.adapter';
import { StripeController } from './stripe.controller';

@Module({
  imports: [OutboxModule],
  controllers: [StripeController],
  exports: [StripeAdapter],
  providers: [
    StripeAdapter,
    {
      provide: STRIPE_CLIENT,
      useFactory: stripeClient,
      inject: [ConfigService],
    },
  ],
})
export class StripeModule {}
