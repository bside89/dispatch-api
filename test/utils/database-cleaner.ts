import { DataSource } from 'typeorm';
import { Redis } from 'ioredis';
import { ADMIN_USER } from '../constants/admin-user.constant';

export async function cleanDatabase(dataSource: DataSource) {
  const entities = dataSource.entityMetadatas;
  const tableNames = entities.map((entity) => `"${entity.tableName}"`).join(', ');

  await dataSource.query(`TRUNCATE ${tableNames} RESTART IDENTITY CASCADE;`);

  // Add a Admin test user for some endpoints
  const hashedPassword =
    '$argon2id$v=19$m=65536,t=3,p=1$IDLXlbsUuUn15tmwMQPaUQ$xwXQGL/RHE9PlJ7xyXZD0yFSGFrPFEqNPUcr1JJue10';
  await dataSource.query(
    `INSERT INTO "users" (id, name, email, password, role) ` +
      `VALUES ('${ADMIN_USER.id}', '${ADMIN_USER.name}', '${ADMIN_USER.email}', '${hashedPassword}', '${ADMIN_USER.role}')`,
  );
}

export async function cleanRedis(redisClient: Redis) {
  await redisClient.flushdb();
}
