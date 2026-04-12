import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { seedMockAdminUser } from './seed-mock-admin-user.helper';
import { HashUtils } from '../utils/hash.utils';

describe(seedMockAdminUser.name, () => {
  const configService = {
    get: jest.fn(),
  } as unknown as ConfigService;

  const logger = {
    debug: jest.fn(),
    log: jest.fn(),
  };

  const userRepository = {
    existsBy: jest.fn(),
    insert: jest.fn(),
  };

  const dataSource = {
    getRepository: jest.fn(() => userRepository),
  } as unknown as DataSource;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(HashUtils, 'hash').mockResolvedValue('hashed-password');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('skips seeding in production', async () => {
    (configService.get as jest.Mock).mockReturnValue('production');

    await seedMockAdminUser(configService, dataSource, logger);

    expect(dataSource.getRepository).not.toHaveBeenCalled();
    expect(userRepository.insert).not.toHaveBeenCalled();
  });

  it('inserts the mock admin user when it does not exist', async () => {
    (configService.get as jest.Mock).mockReturnValue('development');
    userRepository.existsBy.mockResolvedValue(false);

    await seedMockAdminUser(configService, dataSource, logger);

    expect(dataSource.getRepository).toHaveBeenCalledTimes(1);
    expect(userRepository.existsBy).toHaveBeenNthCalledWith(1, {
      id: 'c6d77b5d-1d3f-4c91-9e9d-9b7a8f7c4b21',
    });
    expect(userRepository.existsBy).toHaveBeenNthCalledWith(2, {
      email: 'joao.silva@email.com',
    });
    expect(userRepository.insert).toHaveBeenCalledWith({
      id: 'c6d77b5d-1d3f-4c91-9e9d-9b7a8f7c4b21',
      name: 'João Silva Admin',
      email: 'joao.silva@email.com',
      password: 'hashed-password',
      role: 'admin',
    });
    expect(logger.log).toHaveBeenCalledWith('Mock admin user created', {
      userId: 'c6d77b5d-1d3f-4c91-9e9d-9b7a8f7c4b21',
      email: 'joao.silva@email.com',
    });
  });

  it('does nothing when the mock admin user already exists', async () => {
    (configService.get as jest.Mock).mockReturnValue('development');
    userRepository.existsBy.mockResolvedValue(true);

    await seedMockAdminUser(configService, dataSource, logger);

    expect(userRepository.insert).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      'Mock admin user already exists, skipping seed',
      {
        userId: 'c6d77b5d-1d3f-4c91-9e9d-9b7a8f7c4b21',
        email: 'joao.silva@email.com',
      },
    );
  });
});
