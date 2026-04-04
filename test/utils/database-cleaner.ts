import { DataSource } from 'typeorm';
import { Redis } from 'ioredis';

export async function cleanDatabase(dataSource: DataSource) {
  const entities = dataSource.entityMetadatas;
  const tableNames = entities.map((entity) => `"${entity.tableName}"`).join(', ');

  await dataSource.query(`TRUNCATE ${tableNames} RESTART IDENTITY CASCADE;`);
}

export async function cleanRedis(redisClient: Redis) {
  await redisClient.flushdb();
}
