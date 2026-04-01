import { OrdersService } from '@/modules/orders/orders.service';
import { DataSource } from 'typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '@/app.module';
import { cleanDatabase, cleanRedis } from './utils/database-cleaner';
import Redis from 'ioredis';

describe('App (Integration)', () => {
  let ordersService: OrdersService;
  let dataSource: DataSource;
  let redisClient: Redis;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    ordersService = module.get<OrdersService>(OrdersService);
    dataSource = module.get<DataSource>(DataSource);
    redisClient = module.get<Redis>(Redis);
  });

  beforeEach(async () => {
    await cleanDatabase(dataSource);
    await cleanRedis(redisClient);
  });
});
