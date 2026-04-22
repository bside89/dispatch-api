import { PaymentsGatewayService } from '@/modules/payments-gateway/payments-gateway.service';

const makeCustomer = (id: string) => ({
  id,
  email: 'test@test.com',
  name: 'Test Customer',
  metadata: {},
  address: null,
});

export const paymentsGatewayServiceMock: Pick<
  PaymentsGatewayService,
  | 'customersCreate'
  | 'customersUpdate'
  | 'customersDelete'
  | 'customersList'
  | 'customersRetrieve'
  | 'paymentsCreate'
  | 'paymentsRetrieve'
  | 'refundsCreate'
  | 'refundsRetrieve'
  | 'constructWebhookEvent'
> = {
  customersCreate: jest.fn(async () => makeCustomer('cus_test_create')),
  customersUpdate: jest.fn(async () => makeCustomer('cus_test_update')),
  customersDelete: jest.fn(async () => undefined),
  customersList: jest.fn(async () => [makeCustomer('cus_test_list')]),
  customersRetrieve: jest.fn(async () => makeCustomer('cus_test_retrieve')),
  paymentsCreate: jest.fn(async () => ({
    id: 'pi_test_mock',
    status: 'requires_confirmation',
    clientSecret: 'pi_test_mock_secret',
    currency: 'brl',
    amount: 0,
    livemode: false,
  })),
  paymentsRetrieve: jest.fn(async () => ({
    id: 'pi_test_mock',
    status: 'requires_confirmation',
    clientSecret: 'pi_test_mock_secret',
    currency: 'brl',
    amount: 0,
    livemode: false,
  })),
  refundsCreate: jest.fn(async () => undefined),
  refundsRetrieve: jest.fn(async () => undefined),
  constructWebhookEvent: jest.fn(() => ({
    type: 'UNKNOWN' as never,
    data: {
      externalId: 'evt_test_mock',
      status: 'unknown',
      metadata: {},
    },
  })),
};
