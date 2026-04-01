import { Controller, Get, VERSION_NEUTRAL, Inject } from '@nestjs/common';
import { Public } from './modules/auth/decorators/public.decorator';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import Redis from 'ioredis';

@Controller({ version: VERSION_NEUTRAL })
@ApiTags('default')
export class AppController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
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
            throw new Error('Redis ping failed');
          }
          return { redis: { status: 'up' } };
        } catch (e: any) {
          throw new HealthCheckError('Redis check failed', {
            redis: { status: 'down', message: e.message },
          });
        }
      },
    ]);
  }
}
