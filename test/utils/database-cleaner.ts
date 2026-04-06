import { DataSource } from 'typeorm';
import { Redis } from 'ioredis';
import { HashUtils } from '@/shared/utils/hash.utils';
import { ADMIN_USER } from '../constants/admin-user.constant';

export async function cleanDatabase(dataSource: DataSource) {
  const entities = dataSource.entityMetadatas;
  const tableNames = entities.map((entity) => `"${entity.tableName}"`).join(', ');

  await dataSource.query(`TRUNCATE ${tableNames} RESTART IDENTITY CASCADE;`);

  // Add a Admin test user for some endpoints
  const passwordHashed = await HashUtils.hash(ADMIN_USER.password);
  await dataSource.query(
    `INSERT INTO "users" (id, name, email, password, role) ` +
      `VALUES ('${ADMIN_USER.id}', '${ADMIN_USER.name}', '${ADMIN_USER.email}', '${passwordHashed}', '${ADMIN_USER.role}')`,
  );
}

export async function cleanRedis(redisClient: Redis) {
  await redisClient.flushdb();
}
