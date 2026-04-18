import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

const stripeHost = (testMode: string) => {
  if (testMode === 'docker') {
    return 'stripe-mock';
  }
  if (testMode === 'local') {
    return 'localhost';
  }
  return 'api.stripe.com';
};

const stripePort = (testMode: string) => {
  if (testMode === 'docker' || testMode === 'local') {
    return 12111;
  }
  return 443;
};

const stripeProtocol = (testMode: string) => {
  if (testMode === 'docker' || testMode === 'local') {
    return 'http';
  }

  return 'https';
};

export const stripeConfig = (testMode: string) => ({
  host: stripeHost(testMode),
  port: stripePort(testMode),
  protocol: stripeProtocol(testMode),
});

export const stripeClient = (configService: ConfigService): Stripe.Stripe =>
  Stripe(
    configService.getOrThrow<string>('STRIPE_SECRET_KEY'),
    stripeConfig(configService.get<string>('STRIPE_TEST_MODE')),
  );
