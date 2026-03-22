import { JobProcessingStrategy } from '../strategies/job-processing.strategy';
import { ProcessOrderStrategy } from '../strategies/process-order.strategy';
import { StatusUpdateStrategy } from '../strategies/status-update.strategy';
import { CancelOrderStrategy } from '../strategies/cancel-order.strategy';
import { OrderJob } from '../enums/order-job.enum';

export class JobHandlerFactory {
  private static readonly strategies = new Map<string, JobProcessingStrategy>([
    [OrderJob.ProcessOrder, new ProcessOrderStrategy()],
    [OrderJob.UpdateStatus, new StatusUpdateStrategy()],
    [OrderJob.CancelOrder, new CancelOrderStrategy()],
  ]);

  static createHandler(jobType: string): JobProcessingStrategy | null {
    return this.strategies.get(jobType) || null;
  }

  static getSupportedJobTypes(): string[] {
    return Array.from(this.strategies.keys());
  }

  static registerStrategy(
    jobType: string,
    strategy: JobProcessingStrategy,
  ): void {
    this.strategies.set(jobType, strategy);
  }
}
