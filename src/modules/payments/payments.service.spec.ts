import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PaymentsGatewayService } from '../payments-gateway/payments-gateway.service';
import { OrdersService } from '../orders/orders.service';

const makeWebhookEvent = (
  type: string,
  overrides: Partial<{
    id: string;
    status: string;
    metadata: Record<string, string>;
  }> = {},
) => ({
  type,
  data: {
    object: {
      id: 'pi_default',
      status: 'requires_confirmation',
      metadata: {
        orderId: 'order-default',
      },
      ...overrides,
    },
  },
});

describe('PaymentsService', () => {
  let service: PaymentsService;
  let ordersService: {
    markPaymentAsSucceeded: jest.Mock;
    markPaymentAsFailed: jest.Mock;
  };
  let paymentsGatewayService: {
    constructWebhookEvent: jest.Mock;
  };

  beforeEach(async () => {
    ordersService = {
      markPaymentAsSucceeded: jest.fn(),
      markPaymentAsFailed: jest.fn(),
    };

    paymentsGatewayService = {
      constructWebhookEvent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: OrdersService,
          useValue: ordersService,
        },
        {
          provide: PaymentsGatewayService,
          useValue: paymentsGatewayService,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should mark order as paid when receiving a succeeded payment intent webhook', async () => {
    paymentsGatewayService.constructWebhookEvent.mockReturnValue(
      makeWebhookEvent('payment_intent.succeeded', {
        id: 'pi_123',
        status: 'succeeded',
        metadata: {
          orderId: 'order-123',
        },
      }),
    );

    await service.processWebhookEvent('payload', 'signature', 'secret');

    expect(paymentsGatewayService.constructWebhookEvent).toHaveBeenCalledWith(
      'payload',
      'signature',
      'secret',
    );
    expect(ordersService.markPaymentAsSucceeded).toHaveBeenCalledWith(
      'order-123',
      'pi_123',
      'succeeded',
    );
    expect(ordersService.markPaymentAsFailed).not.toHaveBeenCalled();
  });

  it('should mark order as failed when receiving a failed payment intent webhook', async () => {
    paymentsGatewayService.constructWebhookEvent.mockReturnValue(
      makeWebhookEvent('payment_intent.payment_failed', {
        id: 'pi_456',
        status: 'requires_payment_method',
        metadata: {
          orderId: 'order-456',
        },
      }),
    );

    await service.processWebhookEvent('payload', 'signature', 'secret');

    expect(ordersService.markPaymentAsFailed).toHaveBeenCalledWith(
      'order-456',
      'pi_456',
      'requires_payment_method',
    );
    expect(ordersService.markPaymentAsSucceeded).not.toHaveBeenCalled();
  });

  it('should ignore webhook events without an order id in metadata', async () => {
    paymentsGatewayService.constructWebhookEvent.mockReturnValue(
      makeWebhookEvent('payment_intent.succeeded', {
        id: 'pi_789',
        status: 'succeeded',
        metadata: undefined,
      }),
    );

    await service.processWebhookEvent('payload', 'signature', 'secret');

    expect(ordersService.markPaymentAsSucceeded).not.toHaveBeenCalled();
    expect(ordersService.markPaymentAsFailed).not.toHaveBeenCalled();
  });
});
