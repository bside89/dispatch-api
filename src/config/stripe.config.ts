import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

const STRIPE_MOCK_HOST = 'stripe-mock';
const STRIPE_LOCAL_HOST = 'localhost';
const STRIPE_PROD_HOST = 'api.stripe.com';
const STRIPE_MOCK_PORT = 12111;
const STRIPE_PROD_PORT = 443;

export const stripeConfig = (testMode: string) => {
  const isLocal = testMode === 'docker' || testMode === 'local';
  return {
    host:
      testMode === 'docker'
        ? STRIPE_MOCK_HOST
        : testMode === 'local'
          ? STRIPE_LOCAL_HOST
          : STRIPE_PROD_HOST,
    port: isLocal ? STRIPE_MOCK_PORT : STRIPE_PROD_PORT,
    protocol: isLocal ? ('http' as const) : ('https' as const),
  };
};

export const stripeClient = (configService: ConfigService): Stripe.Stripe =>
  Stripe(
    configService.getOrThrow<string>('STRIPE_SECRET_KEY'),
    stripeConfig(configService.get<string>('STRIPE_EXEC_MODE')),
  );
