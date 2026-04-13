import { PaymentsGatewayService } from '@/modules/payments-gateway/payments-gateway.service';

const makeCustomer = (id: string) => ({
  id,
  email: 'test@test.com',
  name: 'Test Customer',
  businessName: null,
  individualName: null,
  phone: null,
  description: null,
  balance: 0,
  invoicePrefix: null,
  defaultPaymentMethodId: null,
  preferredLocales: [],
  metadata: {},
  taxExempt: null,
  address: null,
  shipping: null,
  taxIds: [],
  createdAt: new Date(),
  livemode: false,
});

export const paymentsGatewayServiceMock: Pick<
  PaymentsGatewayService,
  | 'customersCreate'
  | 'customersUpdate'
  | 'customersDelete'
  | 'customersList'
  | 'customersRetrieve'
  | 'paymentIntentsCreate'
  | 'paymentIntentsRetrieve'
> = {
  customersCreate: jest.fn(async () => makeCustomer('cus_test_create')),
  customersUpdate: jest.fn(async () => makeCustomer('cus_test_update')),
  customersDelete: jest.fn(async () => undefined),
  customersList: jest.fn(async () => [makeCustomer('cus_test_list')]),
  customersRetrieve: jest.fn(async () => makeCustomer('cus_test_retrieve')),
  paymentIntentsCreate: jest.fn(async () => ({
    id: 'pi_test_mock',
    status: 'requires_confirmation',
    clientSecret: 'pi_test_mock_secret',
    currency: 'brl',
    amount: 0,
    livemode: false,
  })),
  paymentIntentsRetrieve: jest.fn(async () => ({
    id: 'pi_test_mock',
    status: 'requires_confirmation',
    clientSecret: 'pi_test_mock_secret',
    currency: 'brl',
    amount: 0,
    livemode: false,
  })),
};
