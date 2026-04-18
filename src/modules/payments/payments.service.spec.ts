import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PAYMENTS_SERVICE } from './constants/payments.token';
import { PAYMENTS_GATEWAY_SERVICE } from '../payments-gateway/constants/payments-gateway.token';
import { ORDERS_SERVICE } from '../orders/constants/orders.token';
import { ConfigService } from '@nestjs/config';

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
        { provide: PAYMENTS_SERVICE, useClass: PaymentsService },
        {
          provide: ORDERS_SERVICE,
          useValue: ordersService,
        },
        {
          provide: PAYMENTS_GATEWAY_SERVICE,
          useValue: paymentsGatewayService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('secret'),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PAYMENTS_SERVICE);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
