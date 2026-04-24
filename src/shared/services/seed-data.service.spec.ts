import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { SeedDataService } from './seed-data.service';
import { HashAdapter } from '../utils/hash-adapter.utils';
import { Logger } from 'nestjs-pino';

describe('SeedDataService', () => {
  const configService = {
    get: jest.fn(),
  } as unknown as ConfigService;

  const logger = {
    debug: jest.fn(),
    log: jest.fn(),
  } as unknown as Logger;

  const userRepository = {
    existsBy: jest.fn(),
    insert: jest.fn(),
  };

  const itemRepository = {
    existsBy: jest.fn(),
    insert: jest.fn(),
  };

  const dataSource = {
    getRepository: jest.fn((entity) => {
      if (entity.name === 'User') {
        return userRepository;
      }

      return itemRepository;
    }),
  } as unknown as DataSource;

  const paymentsGatewayService = {
    customers: {
      list: jest.fn(),
      create: jest.fn(),
    },
  };

  const createSubject = () =>
    new SeedDataService(
      configService,
      dataSource,
      logger,
      paymentsGatewayService as never,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(HashAdapter, 'hash').mockResolvedValue('hashed-password');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('skips all seeding when SEED_TEST_DATA is not true', async () => {
    (configService.get as jest.Mock).mockReturnValue('false');

    await createSubject().run();

    expect(dataSource.getRepository).not.toHaveBeenCalled();
    expect(userRepository.insert).not.toHaveBeenCalled();
    expect(itemRepository.insert).not.toHaveBeenCalled();
    expect(paymentsGatewayService.customers.list).not.toHaveBeenCalled();
  });

  it('creates the mock admin customer and user when missing', async () => {
    (configService.get as jest.Mock).mockReturnValue('true');
    userRepository.existsBy.mockResolvedValue(false);
    paymentsGatewayService.customers.list.mockResolvedValue([]);
    paymentsGatewayService.customers.create.mockResolvedValue({
      id: 'cus_123',
      email: 'joao.silva@email.com',
      name: 'João Silva Admin',
      metadata: {},
      address: null,
    });

    await createSubject().seedMockAdminUser();

    expect(paymentsGatewayService.customers.list).toHaveBeenCalledTimes(1);
    expect(paymentsGatewayService.customers.create).toHaveBeenCalledWith(
      {
        name: 'João Silva Admin',
        email: 'joao.silva@email.com',
        address: {
          line1: 'Av. Paulista, 1000',
          line2: 'Apto 101',
          city: 'São Paulo',
          state: 'SP',
          postalCode: '01000-000',
          country: 'BR',
        },
      },
      'seed-mock-admin-user-c6d77b5d-1d3f-4c91-9e9d-9b7a8f7c4b21',
    );
    expect(userRepository.insert).toHaveBeenCalledWith({
      id: 'c6d77b5d-1d3f-4c91-9e9d-9b7a8f7c4b21',
      name: 'João Silva Admin',
      email: 'joao.silva@email.com',
      password: 'hashed-password',
      role: 'admin',
      customerId: 'cus_123',
    });
    expect(logger.log).toHaveBeenCalledWith('Mock admin user created', {
      userId: 'c6d77b5d-1d3f-4c91-9e9d-9b7a8f7c4b21',
      email: 'joao.silva@email.com',
      customerId: 'cus_123',
    });
  });

  it('skips the mock admin user when it already exists', async () => {
    (configService.get as jest.Mock).mockReturnValue('true');
    userRepository.existsBy.mockResolvedValue(true);

    await createSubject().seedMockAdminUser();

    expect(paymentsGatewayService.customers.list).not.toHaveBeenCalled();
    expect(paymentsGatewayService.customers.create).not.toHaveBeenCalled();
    expect(userRepository.insert).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      'Mock admin user already exists, skipping seed',
      {
        userId: 'c6d77b5d-1d3f-4c91-9e9d-9b7a8f7c4b21',
        email: 'joao.silva@email.com',
      },
    );
  });

  it('seeds the mock items when they do not exist', async () => {
    (configService.get as jest.Mock).mockReturnValue('true');
    itemRepository.existsBy.mockResolvedValue(false);

    await createSubject().seedMockItems();

    expect(dataSource.getRepository).toHaveBeenCalledTimes(1);
    expect(itemRepository.existsBy).toHaveBeenCalledTimes(4);
    expect(itemRepository.insert).toHaveBeenCalledTimes(4);
    expect(logger.log).toHaveBeenCalledTimes(4);
  });

  it('skips items that already exist', async () => {
    (configService.get as jest.Mock).mockReturnValue('true');
    itemRepository.existsBy.mockResolvedValueOnce(true);
    itemRepository.existsBy.mockResolvedValueOnce(false);
    itemRepository.existsBy.mockResolvedValueOnce(true);
    itemRepository.existsBy.mockResolvedValueOnce(false);

    await createSubject().seedMockItems();

    expect(itemRepository.insert).toHaveBeenCalledTimes(2);
    expect(logger.debug).toHaveBeenCalledTimes(2);
  });
});
