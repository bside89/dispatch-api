import { Controller, Get, VERSION_NEUTRAL, Inject } from '@nestjs/common';
import { Public } from './modules/auth/decorators/public.decorator';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ensureError } from '@/shared/utils/functions.utils';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorService,
  TypeOrmHealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './shared/modules/cache/constants/redis-client.token';

@Controller({ version: VERSION_NEUTRAL })
@ApiTags('default')
export class AppController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private healthIndicatorService: HealthIndicatorService,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
  ) {}

  @Get('health')
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Health check' })
  @ApiResponse({ status: 200, description: 'Application is healthy' })
  healthCheck() {
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 1500 }),
      async (): Promise<HealthIndicatorResult> => {
        try {
          const result = await this.redisClient.ping();
          if (result !== 'PONG') {
            return this.healthIndicatorService
              .check('redis')
              .down('Redis ping failed');
          }
          return this.healthIndicatorService.check('redis').up();
        } catch (e) {
          const error = ensureError(e);
          return this.healthIndicatorService.check('redis').down(error.message);
        }
      },
    ]);
  }
}
