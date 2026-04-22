import { PaymentGatewaysService } from '@/modules/payment-gateways/payment-gateways.service';

const makeCustomer = (id: string) => ({
  id,
  email: 'test@test.com',
  name: 'Test Customer',
  metadata: {},
  address: null,
});

type PaymentsGatewayServiceMock = {
  customers: {
    create: PaymentGatewaysService['customers']['create'];
    update: PaymentGatewaysService['customers']['update'];
    delete: PaymentGatewaysService['customers']['delete'];
    list: PaymentGatewaysService['customers']['list'];
    retrieve: PaymentGatewaysService['customers']['retrieve'];
  };
  payments: {
    create: PaymentGatewaysService['payments']['create'];
    retrieve: PaymentGatewaysService['payments']['retrieve'];
  };
  refunds: {
    create: PaymentGatewaysService['refunds']['create'];
    retrieve: PaymentGatewaysService['refunds']['retrieve'];
  };
  webhooks: {
    constructWebhookEvent: PaymentGatewaysService['webhooks']['constructWebhookEvent'];
  };
};

export const paymentsGatewayServiceMock: PaymentsGatewayServiceMock = {
  customers: {
    create: jest.fn(async () => makeCustomer('cus_test_create')),
    update: jest.fn(async () => makeCustomer('cus_test_update')),
    delete: jest.fn(async () => undefined),
    list: jest.fn(async () => [makeCustomer('cus_test_list')]),
    retrieve: jest.fn(async () => makeCustomer('cus_test_retrieve')),
  },
  payments: {
    create: jest.fn(async () => ({
      id: 'pi_test_mock',
      status: 'requires_confirmation',
      clientSecret: 'pi_test_mock_secret',
      currency: 'brl',
      amount: 0,
      livemode: false,
    })),
    retrieve: jest.fn(async () => ({
      id: 'pi_test_mock',
      status: 'requires_confirmation',
      clientSecret: 'pi_test_mock_secret',
      currency: 'brl',
      amount: 0,
      livemode: false,
    })),
  },
  refunds: {
    create: jest.fn(async () => undefined),
    retrieve: jest.fn(async () => undefined),
  },
  webhooks: {
    constructWebhookEvent: jest.fn(() => ({
      type: 'UNKNOWN' as never,
      data: {
        externalId: 'evt_test_mock',
        status: 'unknown',
        metadata: {},
      },
    })),
  },
};
