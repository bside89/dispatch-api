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
    name: 'Hamburguer Clássico',
    description:
      'Hamburguer com carne bovina, queijo, alface, tomate e molho especial.',
    stock: 50,
    price: 2890,
  },
  {
    id: '1f1a8d24-9d2d-4df2-8e44-9f6df7a3c002',
    name: 'Batata Frita Média',
    description:
      'Porção média de batatas crocantes, servida com sal e tempero da casa.',
    stock: 80,
    price: 1490,
  },
  {
    id: '1f1a8d24-9d2d-4df2-8e44-9f6df7a3c003',
    name: 'Refrigerante Lata',
    description: 'Lata de refrigerante gelada com 350 ml.',
    stock: 120,
    price: 790,
  },
  {
    id: '1f1a8d24-9d2d-4df2-8e44-9f6df7a3c004',
    name: 'Milkshake de Chocolate',
    description: 'Milkshake cremoso de chocolate com cobertura de cacau.',
    stock: 35,
    price: 1890,
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
