import { WorkerHost } from '@nestjs/bullmq';
import * as os from 'os';
import { AppLogger } from '../utils/app-logger';
import type { ICacheService } from '../modules/cache/interfaces/cache-service.interface';
import { Job } from 'bullmq';
import { randomUUID } from 'crypto';
import { RequestContext } from '../utils/request-context';
import { BaseJobHandlerFactory } from '../factories/base-job-handler.factory';
import { JobStatus } from '../enums/job-status.enum';
import { ensureError } from '../helpers/functions';
import { BeforeApplicationShutdown, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LOCK_KEY } from '../constants/lock.key';
import { DbGuardService } from '../modules/db-guard/db-guard.service';
import { CACHE_TTL } from '../constants/cache-ttl.constant';

export abstract class BaseProcessor
  extends WorkerHost
  implements OnApplicationBootstrap, BeforeApplicationShutdown
{
  protected readonly logger: AppLogger;

  constructor(
    processorName: string,
    protected readonly cacheService: ICacheService,
    protected readonly configService: ConfigService,
    protected readonly guard: DbGuardService,
  ) {
    super();
    this.logger = new AppLogger(processorName);
  }

  onApplicationBootstrap() {
    this.setupConcurrency();
  }

  async beforeApplicationShutdown(): Promise<void> {
    await this.worker.close();
  }

  async executeJob<T extends BaseJobHandlerFactory>(
    job: Job,
    event: 'process' | 'failed',
    factory: T,
    idempotencyKey: string,
    error?: Error,
  ) {
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
  protected setupConcurrency() {
    const multiplier = this.concurrencyMultiplier;
    const cpuCount = os.cpus().length || 1;
    const resolved =
      Number.isFinite(this.concurrency) && this.concurrency > 0
        ? this.concurrency
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

  /**
   * Each processor can define its own concurrency level. This allows for fine-tuned
   * control over how many jobs a processor can handle simultaneously, based on the
   * expected workload and resource intensity of the jobs it processes.
   */
  protected abstract get concurrency(): number;
}
