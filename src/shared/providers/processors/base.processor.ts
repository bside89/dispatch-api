import { WorkerHost } from '@nestjs/bullmq';
import { BeforeApplicationShutdown, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { randomUUID } from 'crypto';
import * as os from 'os';
import { CACHE_TTL } from '../../constants/cache-ttl.constant';
import { LOCK_KEY } from '../../constants/lock.key';
import { JobStatus } from '../../enums/job-status.enum';
import { BaseJobHandlerFactory } from '../../factories/base-job-handler.factory';
import type { ICacheService } from '../../modules/cache/interfaces/cache-service.interface';
import { DbGuardService } from '../../modules/db-guard/db-guard.service';
import { AppLogger } from '../../utils/app-logger.utils';
import { ensureError } from '../../utils/functions.utils';
import { RequestContext } from '../../utils/request-context.utils';

export abstract class BaseProcessor
  extends WorkerHost
  implements OnApplicationBootstrap, BeforeApplicationShutdown
{
  protected readonly logger: AppLogger;

  protected constructor(
    processorName: string,
    protected readonly cacheService: ICacheService,
    protected readonly configService: ConfigService,
    protected readonly guard: DbGuardService,
  ) {
    super();
    this.logger = new AppLogger(processorName);
  }

  onApplicationBootstrap(): void {
    this.setupConcurrency();
  }

  async beforeApplicationShutdown(): Promise<void> {
    await this.worker.close();
  }

  protected async executeProcessJob<T extends BaseJobHandlerFactory>(
    job: Job,
    factory: T,
    idempotencyKey: string,
  ): Promise<void> {
    return this.executeJob(job, 'process', factory, idempotencyKey);
  }

  protected async executeFailedJob<T extends BaseJobHandlerFactory>(
    job: Job,
    factory: T,
    idempotencyKey: string,
    error: Error,
  ): Promise<void> {
    return this.executeJob(job, 'failed', factory, idempotencyKey, error);
  }

  private executeJob<T extends BaseJobHandlerFactory>(
    job: Job,
    event: 'process' | 'failed',
    factory: T,
    idempotencyKey: string,
    error?: Error,
  ): Promise<void> {
    return this.guard.lock(
      LOCK_KEY.JOB.EXECUTE(job.id),
      () => this._executeJob(job, event, factory, idempotencyKey, error),
      CACHE_TTL.JOB_LOCK,
    );
  }

  private async _executeJob<T extends BaseJobHandlerFactory>(
    job: Job,
    event: 'process' | 'failed',
    factory: T,
    idempotencyKey: string,
    error?: Error,
  ): Promise<void> {
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
        await this.cacheService.set(idempotencyKey, JobStatus.FAILED);

        const error = ensureError(e);
        this.logger.error(
          `Error executing job ${job.name} with id ${job.id}: ${error.message}`,
        );

        throw error;
      }
    });
  }

  /**
   * Sets up the concurrency for the worker.
   * The concurrency level is determined by the processor's `concurrency` property.
   */
  protected setupConcurrency(): void {
    const cpuCount = os.cpus().length || 1;
    this.worker.concurrency =
      Number.isFinite(this.concurrency) && this.concurrency > 0
        ? this.concurrency
        : cpuCount * this.concurrencyMultiplier;
  }

  /**
   * Each processor can define its own multiplier to adjust concurrency based on the
   * expected workload and resource intensity of the jobs it processes. For example,
   * a processor handling lightweight tasks might have a higher multiplier, while one
   * dealing with heavy computations or I/O might have a lower multiplier to avoid
   * overwhelming the system.
   */
  protected abstract get concurrencyMultiplier(): number;

  /**
   * Each processor can define its own concurrency level. This allows for fine-tuned
   * control over how many jobs a processor can handle simultaneously, based on the
   * expected workload and resource intensity of the jobs it processes.
   */
  protected abstract get concurrency(): number;
}
