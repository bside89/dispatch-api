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
> = {
  customersCreate: jest.fn(async () => makeCustomer('cus_test_create')),
  customersUpdate: jest.fn(async () => makeCustomer('cus_test_update')),
  customersDelete: jest.fn(async () => undefined),
  customersList: jest.fn(async () => [makeCustomer('cus_test_list')]),
  customersRetrieve: jest.fn(async () => makeCustomer('cus_test_retrieve')),
};
