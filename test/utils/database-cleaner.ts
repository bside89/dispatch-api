import { DataSource } from 'typeorm';
import { Redis } from 'ioredis';
import { ADMIN_USER } from '../constants/admin-user.constant';

const truncateTableNamesCache = new WeakMap<DataSource, string>();

export async function cleanDatabase(dataSource: DataSource) {
  const tableNames = getTruncateTableNames(dataSource);

  await dataSource.query(`TRUNCATE ${tableNames} RESTART IDENTITY CASCADE;`);

  // Add a Admin test user for some endpoints
  const hashedPassword =
    '$argon2id$v=19$m=65536,t=3,p=1$IDLXlbsUuUn15tmwMQPaUQ$xwXQGL/RHE9PlJ7xyXZD0yFSGFrPFEqNPUcr1JJue10';
  await dataSource.query(
    `INSERT INTO "users" (id, name, email, password, role) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
    [
      ADMIN_USER.id,
      ADMIN_USER.name,
      ADMIN_USER.email,
      hashedPassword,
      ADMIN_USER.role,
    ],
  );
}

export async function cleanRedis(redisClient: Redis) {
  await redisClient.flushdb();
}

function getTruncateTableNames(dataSource: DataSource): string {
  const cachedTableNames = truncateTableNamesCache.get(dataSource);
  if (cachedTableNames) {
    return cachedTableNames;
  }

  const tableNames = dataSource.entityMetadatas
    .map((entity) => `"${entity.tableName}"`)
    .join(', ');

  truncateTableNamesCache.set(dataSource, tableNames);

  return tableNames;
}
