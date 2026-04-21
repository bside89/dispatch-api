import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { User } from '@/modules/users/entities/user.entity';
import { UserRole } from '@/shared/enums/user-role.enum';
import { HashAdapter } from '../utils/hash-adapter.utils';

type SeedLogger = {
  debug(message: string, data?: Record<string, unknown>): void;
  log(message: string, data?: Record<string, unknown>): void;
};

const MOCK_ADMIN_USER = {
  id: 'c6d77b5d-1d3f-4c91-9e9d-9b7a8f7c4b21',
  name: 'João Silva Admin',
  email: 'joao.silva@email.com',
  password: 'password123',
  role: UserRole.ADMIN,
} as const;

export async function seedMockAdminUser(
  configService: ConfigService,
  dataSource: DataSource,
  logger: SeedLogger,
): Promise<void> {
  if (configService.get('SEED_TEST_DATA') !== 'true') {
    return;
  }

  const userRepository = dataSource.getRepository(User);
  const [idExists, emailExists] = await Promise.all([
    userRepository.existsBy({ id: MOCK_ADMIN_USER.id }),
    userRepository.existsBy({ email: MOCK_ADMIN_USER.email }),
  ]);
  const userExists = idExists || emailExists;

  if (userExists) {
    logger.debug('Mock admin user already exists, skipping seed', {
      userId: MOCK_ADMIN_USER.id,
      email: MOCK_ADMIN_USER.email,
    });
    return;
  }

  await userRepository.insert({
    id: MOCK_ADMIN_USER.id,
    name: MOCK_ADMIN_USER.name,
    email: MOCK_ADMIN_USER.email,
    password: await HashAdapter.hash(MOCK_ADMIN_USER.password),
    role: MOCK_ADMIN_USER.role,
  });

  logger.log('Mock admin user created', {
    userId: MOCK_ADMIN_USER.id,
    email: MOCK_ADMIN_USER.email,
  });
}
