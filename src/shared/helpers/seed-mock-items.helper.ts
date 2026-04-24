import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Item } from '@/modules/items/entities/item.entity';

type SeedLogger = {
  debug(message: string, data?: Record<string, unknown>): void;
  log(message: string, data?: Record<string, unknown>): void;
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

export async function seedMockItems(
  configService: ConfigService,
  dataSource: DataSource,
  logger: SeedLogger,
): Promise<void> {
  if (configService.get('SEED_TEST_DATA') !== 'true') {
    return;
  }

  const itemRepository = dataSource.getRepository(Item);

  for (const item of MOCK_ITEMS) {
    const itemExists = await itemRepository.existsBy({ id: item.id });

    if (itemExists) {
      logger.debug('Mock item already exists, skipping seed', {
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

    logger.log('Mock item created', {
      itemId: item.id,
      name: item.name,
    });
  }
}
