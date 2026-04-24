import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Item } from '@/modules/items/entities/item.entity';
import { PAYMENTS_GATEWAY_SERVICE } from '@/modules/payment-gateways/constants/payments-gateway.token';
import { GatewayCreateCustomerDto } from '@/modules/payment-gateways/dto/gateway-customer.dto';
import type { IPaymentGatewaysService } from '@/modules/payment-gateways/interfaces/payment-gateways-service.interface';
import { User } from '@/modules/users/entities/user.entity';
import { UserRole } from '@/shared/enums/user-role.enum';
import { HashAdapter } from '@/shared/utils/hash-adapter.utils';
import { Logger } from 'nestjs-pino';

const MOCK_ADMIN_USER = {
  id: 'c6d77b5d-1d3f-4c91-9e9d-9b7a8f7c4b21',
  name: 'João Silva Admin',
  email: 'joao.silva@email.com',
  password: 'password123',
  role: UserRole.ADMIN,
} as const;

const MOCK_ADMIN_CUSTOMER: GatewayCreateCustomerDto = {
  name: MOCK_ADMIN_USER.name,
  email: MOCK_ADMIN_USER.email,
  address: {
    line1: 'Av. Paulista, 1000',
    line2: 'Apto 101',
    city: 'São Paulo',
    state: 'SP',
    postalCode: '01000-000',
    country: 'BR',
  },
};

const MOCK_ITEMS = [
  {
    id: '1f1a8d24-9d2d-4df2-8e44-9f6df7a3c001',
    name: 'Chapinha Prancha Cabelo Profissional Nano Titanium 450F BIVOLT atlas',
    description:
      'Chapinha Prancha Cabelo Profissional Nano Titanium 450F BIVOLT atlas.',
    stock: 50,
    price: 8488,
  },
  {
    id: '1f1a8d24-9d2d-4df2-8e44-9f6df7a3c002',
    name: 'Panela de Pressão Elétrica Philco 4L 14 funções PPPE04A',
    description: 'Panela de Pressão Elétrica Philco 4L 14 funções PPPE04A.',
    stock: 80,
    price: 27541,
  },
  {
    id: '1f1a8d24-9d2d-4df2-8e44-9f6df7a3c003',
    name: 'Cooktop a Gás Philco 4 Queimadores Superautomático PCT04TC Bivolt',
    description:
      'Cooktop a gás com 4 queimadores, modelo superautomático PCT04TC, bivolt.',
    stock: 120,
    price: 38941,
  },
  {
    id: '1f1a8d24-9d2d-4df2-8e44-9f6df7a3c004',
    name: 'Kit 4 Alto Falantes Triaxiais JBL 6TRMS80 80 Watts Rms + Módulo Taramps TS400x4',
    description:
      'Kit 4 Alto Falantes Triaxiais JBL 6TRMS80 80 Watts Rms + Módulo Taramps TS400x4.',
    stock: 35,
    price: 70290,
  },
] as const;

@Injectable()
export class SeedDataService {
  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly logger: Logger,
    @Inject(PAYMENTS_GATEWAY_SERVICE)
    private readonly paymentsGatewayService: IPaymentGatewaysService,
  ) {}

  async run(): Promise<void> {
    if (this.configService.get('SEED_TEST_DATA') !== 'true') {
      return;
    }
    await this.seedMockAdminUser();
    await this.seedMockItems();
  }

  async seedMockAdminUser(): Promise<void> {
    const userRepository = this.dataSource.getRepository(User);
    const [idExists, emailExists] = await Promise.all([
      userRepository.existsBy({ id: MOCK_ADMIN_USER.id }),
      userRepository.existsBy({ email: MOCK_ADMIN_USER.email }),
    ]);
    const userExists = idExists || emailExists;

    if (userExists) {
      this.logger.debug('Mock admin user already exists, skipping seed', {
        userId: MOCK_ADMIN_USER.id,
        email: MOCK_ADMIN_USER.email,
      });
      return;
    }

    const customerId = await this.ensureMockAdminCustomer();

    await userRepository.insert({
      id: MOCK_ADMIN_USER.id,
      name: MOCK_ADMIN_USER.name,
      email: MOCK_ADMIN_USER.email,
      password: await HashAdapter.hash(MOCK_ADMIN_USER.password),
      role: MOCK_ADMIN_USER.role,
      customerId,
    });

    this.logger.log('Mock admin user created', {
      userId: MOCK_ADMIN_USER.id,
      email: MOCK_ADMIN_USER.email,
      customerId,
    });
  }

  async seedMockItems(): Promise<void> {
    const itemRepository = this.dataSource.getRepository(Item);

    for (const item of MOCK_ITEMS) {
      const itemExists = await itemRepository.existsBy({ id: item.id });

      if (itemExists) {
        this.logger.debug('Mock item already exists, skipping seed', {
          itemId: item.id,
          name: item.name,
        });
        continue;
      }

      await itemRepository.insert({
        id: item.id,
        name: item.name,
        description: item.description,
        stock: item.stock,
        price: item.price,
      });

      this.logger.log('Mock item created', {
        itemId: item.id,
        name: item.name,
      });
    }
  }

  private async ensureMockAdminCustomer(): Promise<string> {
    const customers = await this.paymentsGatewayService.customers.list();
    const existingCustomer = customers.find(
      (customer) => customer.email === MOCK_ADMIN_USER.email,
    );

    if (existingCustomer) {
      return existingCustomer.id;
    }

    const createdCustomer = await this.paymentsGatewayService.customers.create(
      MOCK_ADMIN_CUSTOMER,
      `seed-mock-admin-user-${MOCK_ADMIN_USER.id}`,
    );

    return createdCustomer.id;
  }
}
