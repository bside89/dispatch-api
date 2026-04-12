import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsGatewayService } from './payments-gateway.service';
import { StripeCustomersGateway } from './gateways/stripe-customers.gateway';
import { StripePaymentIntentsGateway } from './gateways/stripe-payment-intents.gateway';

describe('PaymentsGatewayService', () => {
  let service: PaymentsGatewayService;
  let stripePaymentIntentsGateway: {
    create: jest.Mock;
    retrieve: jest.Mock;
  };

  beforeEach(async () => {
    stripePaymentIntentsGateway = {
      create: jest.fn(),
      retrieve: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsGatewayService,
        {
          provide: StripeCustomersGateway,
          useValue: {
            create: jest.fn(),
            list: jest.fn(),
            retrieve: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: StripePaymentIntentsGateway,
          useValue: stripePaymentIntentsGateway,
        },
      ],
    }).compile();

    service = module.get<PaymentsGatewayService>(PaymentsGatewayService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create payment intents through the stripe gateway', async () => {
    const paymentIntent = {
      id: 'pi_123',
      status: 'requires_confirmation',
      amount: 2599,
      currency: 'brl',
      customer: 'cus_123',
      client_secret: 'pi_123_secret_456',
      payment_method: 'pm_123',
      latest_charge: 'ch_123',
      metadata: { orderId: 'order_123' },
      livemode: false,
    };

    stripePaymentIntentsGateway.create.mockResolvedValue(paymentIntent);

    const result = await service.paymentIntentsCreate(
      {
        amount: 2599,
        currency: 'brl',
        customer: 'cus_123',
        metadata: { orderId: 'order_123' },
        automatic_payment_methods: { enabled: true },
      },
      'idem_123',
    );

    expect(stripePaymentIntentsGateway.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2599,
        currency: 'brl',
        customer: 'cus_123',
        metadata: expect.objectContaining({ orderId: 'order_123' }),
        automatic_payment_methods: { enabled: true },
      }),
      'idem_123',
    );
    expect(result).toMatchObject({
      id: 'pi_123',
      status: 'requires_confirmation',
      customerId: 'cus_123',
      clientSecret: 'pi_123_secret_456',
      metadata: { orderId: 'order_123' },
    });
    expect(result.amount).toBe(2599);
    expect(result.currency).toBe('brl');
    expect(result.paymentMethodId).toBe('pm_123');
    expect(result.latestChargeId).toBe('ch_123');
    expect(result.livemode).toBe(false);
  });
});
