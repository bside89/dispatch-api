import { WorkerHost } from '@nestjs/bullmq';
import * as os from 'os';
import { AppLogger } from '../utils/app-logger';
import Redlock from 'redlock';
import { CacheService } from '../modules/cache/cache.service';
import { UseLock } from '../decorators/lock.decorator';
import { Job } from 'bullmq';
import { randomUUID } from 'crypto';
import { RequestContext } from '../utils/request-context';
import { BaseJobHandlerFactory } from '../factories/base-job-handler.factory';
import { JobStatus } from '../enums/job-status.enum';
import { ensureError } from '../helpers/functions';
import { BeforeApplicationShutdown, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export abstract class BaseProcessor
  extends WorkerHost
  implements OnApplicationBootstrap, BeforeApplicationShutdown
{
  protected readonly logger: AppLogger;

  constructor(
    protected readonly processorName: string,
    protected readonly cacheService: CacheService,
    protected readonly configService: ConfigService,
    protected readonly redlock: Redlock, // Used in @UseLock()
  ) {
    super();
    this.logger = new AppLogger(processorName);
  }

  onApplicationBootstrap() {
    const concurrency = this.configService.get<string>('QUEUE_ORDER_CONCURRENCY');
    this.setupConcurrency(Number(concurrency));
  }

  async beforeApplicationShutdown(): Promise<void> {
    await this.worker.close();
  }

  @UseLock({ prefix: 'job-execute', key: ([job]) => job.id })
  async executeJob<T extends BaseJobHandlerFactory>(
    job: Job,
    event: 'process' | 'failed',
    factory: T,
    idempotencyKey: string,
    error?: Error,
  ) {
    const correlationId = job.data?.correlationId ?? randomUUID();

    return RequestContext.run(correlationId, async () => {
      const idempotencyValue = await this.cacheService.get(idempotencyKey);
      if (idempotencyValue && idempotencyValue !== JobStatus.FAILED) {
        return;
      }
      await this.cacheService.set(idempotencyKey, JobStatus.IN_PROGRESS);

      try {
        // Select the appropriate job strategy based on job name and event type
        const handler = factory.createHandler(job.name);

        if (!handler) {
          this.logger.warn(`Unknown job: ${job.name}`);
          return;
        }

        if (event === 'failed') {
          await handler.executeAfterFail(job, error!);
        } else {
          await handler.execute(job);
        }

        await this.cacheService.set(idempotencyKey, JobStatus.COMPLETED);
      } catch (e) {
        const error = ensureError(e);

        await this.cacheService.set(idempotencyKey, JobStatus.FAILED);

        this.logger.error(
          `Error executing job ${job.name} with id ${job.id}: ${error.message}`,
        );

        throw error;
      }
    });
  }

  /**
   * Sets up the concurrency for the worker.
   * @param concurrency The desired concurrency level. If not provided, it will be
   * calculated based on the number of CPU cores and a multiplier.
   */
  protected setupConcurrency(concurrency?: number) {
    const multiplier = this.concurrencyMultiplier;
    const cpuCount = os.cpus().length || 1;
    const resolved =
      Number.isFinite(concurrency) && concurrency > 0
        ? concurrency
        : cpuCount * multiplier;
    this.worker.concurrency = resolved;
  }

  /**
   * Each processor can define its own multiplier to adjust concurrency based on the
   * expected workload and resource intensity of the jobs it processes. For example,
   * a processor handling lightweight tasks might have a higher multiplier, while one
   * dealing with heavy computations or I/O might have a lower multiplier to avoid
   * overwhelming the system.
   */
  protected abstract get concurrencyMultiplier(): number;
}
