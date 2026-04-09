import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsGatewayService } from './payments-gateway.service';
import { StripeCustomersGateway } from './gateways/stripe-customers.gateway';

describe('PaymentsGatewayService', () => {
  let service: PaymentsGatewayService;

  beforeEach(async () => {
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
      ],
    }).compile();

    service = module.get<PaymentsGatewayService>(PaymentsGatewayService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
