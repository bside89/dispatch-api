import { AppModule } from '@/app.module';
import { PAYMENTS_GATEWAY_SERVICE } from '@/modules/payments-gateway/constants/payments-gateway.token';
import { REDIS_CLIENT } from '@/shared/modules/cache/constants/redis-client.token';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { paymentsGatewayServiceMock } from './mock-payments-gateway-service';

export interface TestAppContext {
  app: INestApplication;
  module: TestingModule;
  dataSource: DataSource;
  redisClient: Redis;
  jwtService: JwtService;
}

export async function createTestApp(): Promise<TestAppContext> {
  const module: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PAYMENTS_GATEWAY_SERVICE)
    .useValue(paymentsGatewayServiceMock)
    .compile();

  const app = module.createNestApplication();

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.init();

  return {
    app,
    module,
    dataSource: app.get<DataSource>(DataSource),
    redisClient: app.get<Redis>(REDIS_CLIENT),
    jwtService: app.get<JwtService>(JwtService),
  };
}
