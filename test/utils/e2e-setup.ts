import { AppModule } from '@/app.module';
import { PAYMENTS_GATEWAY_SERVICE } from '@/modules/payment-gateways/constants/payments-gateway.token';
import { OUTBOX_SERVICE } from '@/shared/modules/outbox/constants/outbox.token';
import { REDIS_CLIENT } from '@/shared/modules/cache/constants/redis-client.token';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import Redis from 'ioredis';
import Redlock from 'redlock';
import { DataSource } from 'typeorm';
import { paymentsGatewayServiceMock } from './mock-payments-gateway-service';

// No-op: E2E tests only validate HTTP request/response.
// Async background flows (Outbox dispatch, BullMQ workers, distributed locks)
// are covered by the integration tests (*.int-spec.ts).
const outboxServiceMock = {
  add: jest.fn().mockResolvedValue(undefined),
};

// Passthrough: DbGuardService.lock() still executes the work function, but
// skips the actual Redis acquire/release so no quorum errors can occur when
// Redis is flushed between beforeEach cycles.
const redlockMock: Pick<Redlock, 'acquire' | 'release'> = {
  acquire: jest.fn().mockResolvedValue({}),
  release: jest.fn().mockResolvedValue(undefined),
};

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
    .overrideProvider(OUTBOX_SERVICE)
    .useValue(outboxServiceMock)
    .overrideProvider(Redlock)
    .useValue(redlockMock)
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
