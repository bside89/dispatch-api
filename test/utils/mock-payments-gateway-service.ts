import { IPaymentsGatewayAdapter } from '@/modules/payments/interfaces/payments-gateway-adapter.interface';

const makeCustomer = (id: string) => ({
  id,
  email: 'test@test.com',
  name: 'Test Customer',
  metadata: { userId: 'user_test' },
  address: undefined,
});

const makePayment = (id: string) => ({
  id,
  status: 'requires_confirmation',
  secret: 'pi_test_mock_secret',
});

const makeRefund = (refundId: string) => ({
  refundId,
  paymentId: 'pi_test_mock',
  amount: 0,
});

export const paymentsGatewayServiceMock = {
  createCustomer: jest.fn().mockResolvedValue(makeCustomer('cus_test_create')),
  findAllCustomers: jest.fn().mockResolvedValue({
    items: [makeCustomer('cus_test_list')],
    nextCursor: undefined,
    hasMore: false,
  }),
  findOneCustomer: jest.fn().mockResolvedValue(makeCustomer('cus_test_retrieve')),
  updateCustomer: jest.fn().mockResolvedValue(makeCustomer('cus_test_update')),
  deleteCustomer: jest.fn().mockResolvedValue(undefined),
  createPayment: jest.fn().mockResolvedValue(makePayment('pi_test_create')),
  findOnePayment: jest.fn().mockResolvedValue(makePayment('pi_test_retrieve')),
  createRefundPayment: jest.fn().mockResolvedValue(makeRefund('re_test_create')),
  findOneRefundPayment: jest.fn().mockResolvedValue(makeRefund('re_test_retrieve')),
} as jest.Mocked<IPaymentsGatewayAdapter>;
