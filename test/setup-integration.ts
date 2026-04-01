import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';

export default async () => {
  console.log('\nStarting Testcontainers for Integration Tests...');

  const postgres = await new PostgreSqlContainer('postgres:15')
    .withDatabase('test_db')
    .withUsername('test_user')
    .withPassword('test_pass')
    .start();

  const redis = await new RedisContainer('redis:7-alpine').start();

  // We inject the dynamic URLs into environment variables.
  // NestJS will use them when loading the ConfigService or TypeOrmModule.
  process.env.DB_HOST = postgres.getHost();
  process.env.DB_PORT = postgres.getMappedPort(5432).toString();
  process.env.DB_USERNAME = 'test_user';
  process.env.DB_PASSWORD = 'test_pass';
  process.env.DB_DATABASE = 'test_db';
  process.env.DB_SYNCHRONIZE = 'true';

  process.env.REDIS_HOST = redis.getHost();
  process.env.REDIS_PORT = redis.getMappedPort(6379).toString();

  process.env.APP_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'test-jwt-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret';

  console.log('Containers are ready.');

  // We store the references so that the globalTeardown can stop them
  (global as any).__POSTGRES_CONTAINER__ = postgres;
  (global as any).__REDIS_CONTAINER__ = redis;
};
