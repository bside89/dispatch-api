import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { JobHandlerFactory } from './factories/job-handler.factory';
import { JobQueue } from '../common/enums/job-queue.enum';

@Processor(JobQueue.ORDER_PROCESSING)
export class OrderProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderProcessor.name);

  async process(job: Job): Promise<void> {
    const { name } = job;

    this.logger.log(`Processing job: ${name} with id: ${job.id}`);

    // Use Factory Pattern to get appropriate strategy
    const handler = JobHandlerFactory.createHandler(name);

    if (handler) {
      await handler.execute(job, this.logger);
    } else {
      this.logger.warn(
        `Unknown job type: ${name}. Supported types: ${JobHandlerFactory.getSupportedJobTypes().join(', ')}`,
      );
    }
  }
}
