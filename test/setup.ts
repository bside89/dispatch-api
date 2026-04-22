/*eslint-disable @typescript-eslint/no-explicit-any */
import 'tsconfig-paths/register';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';

export default async () => {
  console.log('\nStarting Testcontainers...');

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
  process.env.DB_USERNAME = postgres.getUsername();
  process.env.DB_PASSWORD = postgres.getPassword();
  process.env.DB_DATABASE = postgres.getDatabase();
  process.env.DB_SYNCHRONIZE = 'true';

  process.env.REDIS_HOST = redis.getHost();
  process.env.REDIS_PORT = redis.getMappedPort(6379).toString();

  process.env.APP_ENV = 'test';
  process.env.TEST_ENV = 'true';
  process.env.JWT_ACCESS_SECRET = 'test-jwt-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret';
  process.env.STRIPE_EXEC_MODE = 'local';
  process.env.STRIPE_SECRET_KEY = 'sk_test_your_secret_key_here';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_your_STRIPE_WEBHOOK_SECRET_here';
  process.env.QUEUE_ORDER_CONCURRENCY = '1';
  process.env.QUEUE_SE_CONCURRENCY = '1';
  process.env.QUEUE_PAYMENT_CONCURRENCY = '1';

  const dataSource = require('../src/config/typeorm.config').default;
  await dataSource.initialize();
  await dataSource.destroy();

  console.log('Containers are ready.');

  // We store the references so that the globalTeardown can stop them
  (global as any).__POSTGRES_CONTAINER__ = postgres;
  (global as any).__REDIS_CONTAINER__ = redis;
};
