import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { seedMockItems } from './seed-mock-items.helper';

describe('seedMockItems', () => {
  const configService = {
    get: jest.fn(),
  } as unknown as ConfigService;

  const logger = {
    debug: jest.fn(),
    log: jest.fn(),
  };

  const itemRepository = {
    existsBy: jest.fn(),
    insert: jest.fn(),
  };

  const dataSource = {
    getRepository: jest.fn(() => itemRepository),
  } as unknown as DataSource;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips seeding when SEED_TEST_DATA is not true', async () => {
    (configService.get as jest.Mock).mockReturnValue('false');

    await seedMockItems(configService, dataSource, logger);

    expect(dataSource.getRepository).not.toHaveBeenCalled();
    expect(itemRepository.insert).not.toHaveBeenCalled();
  });

  it('skips seeding when SEED_TEST_DATA is missing', async () => {
    (configService.get as jest.Mock).mockReturnValue(undefined);

    await seedMockItems(configService, dataSource, logger);

    expect(dataSource.getRepository).not.toHaveBeenCalled();
    expect(itemRepository.insert).not.toHaveBeenCalled();
  });

  it('inserts the mock items when they do not exist', async () => {
    (configService.get as jest.Mock).mockReturnValue('true');
    itemRepository.existsBy.mockResolvedValue(false);

    await seedMockItems(configService, dataSource, logger);

    expect(dataSource.getRepository).toHaveBeenCalledTimes(1);
    expect(itemRepository.existsBy).toHaveBeenCalledTimes(4);
    expect(itemRepository.existsBy).toHaveBeenNthCalledWith(1, {
      id: '1f1a8d24-9d2d-4df2-8e44-9f6df7a3c001',
    });
    expect(itemRepository.existsBy).toHaveBeenNthCalledWith(2, {
      id: '1f1a8d24-9d2d-4df2-8e44-9f6df7a3c002',
    });
    expect(itemRepository.existsBy).toHaveBeenNthCalledWith(3, {
      id: '1f1a8d24-9d2d-4df2-8e44-9f6df7a3c003',
    });
    expect(itemRepository.existsBy).toHaveBeenNthCalledWith(4, {
      id: '1f1a8d24-9d2d-4df2-8e44-9f6df7a3c004',
    });
    expect(itemRepository.insert).toHaveBeenCalledTimes(4);
    expect(itemRepository.insert).toHaveBeenNthCalledWith(1, {
      id: '1f1a8d24-9d2d-4df2-8e44-9f6df7a3c001',
      name: 'Chapinha Prancha Cabelo Profissional Nano Titanium 450F BIVOLT atlas',
      description:
        'Chapinha Prancha Cabelo Profissional Nano Titanium 450F BIVOLT atlas.',
      stock: 50,
      price: 8488,
    });
    expect(itemRepository.insert).toHaveBeenNthCalledWith(2, {
      id: '1f1a8d24-9d2d-4df2-8e44-9f6df7a3c002',
      name: 'Panela de Pressão Elétrica Philco 4L 14 funções PPPE04A',
      description: 'Panela de Pressão Elétrica Philco 4L 14 funções PPPE04A.',
      stock: 80,
      price: 27541,
    });
    expect(itemRepository.insert).toHaveBeenNthCalledWith(3, {
      id: '1f1a8d24-9d2d-4df2-8e44-9f6df7a3c003',
      name: 'Cooktop a Gás Philco 4 Queimadores Superautomático PCT04TC Bivolt',
      description:
        'Cooktop a gás com 4 queimadores, modelo superautomático PCT04TC, bivolt.',
      stock: 120,
      price: 38941,
    });
    expect(itemRepository.insert).toHaveBeenNthCalledWith(4, {
      id: '1f1a8d24-9d2d-4df2-8e44-9f6df7a3c004',
      name: 'Kit 4 Alto Falantes Triaxiais JBL 6TRMS80 80 Watts Rms + Módulo Taramps TS400x4',
      description:
        'Kit 4 Alto Falantes Triaxiais JBL 6TRMS80 80 Watts Rms + Módulo Taramps TS400x4.',
      stock: 35,
      price: 70290,
    });
    expect(logger.log).toHaveBeenCalledTimes(4);
  });

  it('skips items that already exist', async () => {
    (configService.get as jest.Mock).mockReturnValue('true');
    itemRepository.existsBy.mockResolvedValueOnce(true);
    itemRepository.existsBy.mockResolvedValueOnce(false);
    itemRepository.existsBy.mockResolvedValueOnce(true);
    itemRepository.existsBy.mockResolvedValueOnce(false);

    await seedMockItems(configService, dataSource, logger);

    expect(itemRepository.insert).toHaveBeenCalledTimes(2);
    expect(logger.debug).toHaveBeenCalledTimes(2);
    expect(logger.debug).toHaveBeenNthCalledWith(
      1,
      'Mock item already exists, skipping seed',
      {
        itemId: '1f1a8d24-9d2d-4df2-8e44-9f6df7a3c001',
        name: 'Chapinha Prancha Cabelo Profissional Nano Titanium 450F BIVOLT atlas',
      },
    );
    expect(logger.debug).toHaveBeenNthCalledWith(
      2,
      'Mock item already exists, skipping seed',
      {
        itemId: '1f1a8d24-9d2d-4df2-8e44-9f6df7a3c003',
        name: 'Cooktop a Gás Philco 4 Queimadores Superautomático PCT04TC Bivolt',
      },
    );
  });
});
