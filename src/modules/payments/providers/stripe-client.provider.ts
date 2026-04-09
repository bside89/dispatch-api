import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { stripeConfig } from '@/config/payments.config';
import { STRIPE_CLIENT } from '../constants/stripe-client.token';

export const stripeClientProvider = {
  provide: STRIPE_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): Stripe.Stripe =>
    Stripe(
      configService.getOrThrow<string>('STRIPE_SECRET_KEY'),
      stripeConfig(configService.get<string>('STRIPE_TEST_MODE')),
    ),
};
