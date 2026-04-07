import * as dotenv from 'dotenv';
dotenv.config();

import dataSource from '../src/config/typeorm.config';
import Redis from 'ioredis';
import { cleanDatabase, cleanRedis } from '../test/utils/database-cleaner';

async function reset() {
  console.log('Connecting to database...');
  await dataSource.initialize();
  
  console.log('Connecting to Redis...');
  const redisUrl = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;
  const redisClient = new Redis(redisUrl);

  try {
    console.log('Cleaning database...');
    await cleanDatabase(dataSource);
    console.log('Database cleaned and admin user inserted.');

    console.log('Cleaning Redis...');
    await cleanRedis(redisClient);
    console.log('Redis cleaned.');
  } catch (error) {
    console.error('Error during reset:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
    redisClient.disconnect();
    console.log('Connections closed.');
  }
}

reset();
