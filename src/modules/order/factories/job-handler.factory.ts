import { Injectable } from '@nestjs/common';
import { ProcessOrderStrategy } from '../strategies/process-order.strategy';
import { StatusUpdateStrategy } from '../strategies/status-update.strategy';
import { CancelOrderStrategy } from '../strategies/cancel-order.strategy';
import { OrderJob } from '../enums/order-job.enum';

@Injectable()
export class JobHandlerFactory {
  constructor(
    private readonly processOrder: ProcessOrderStrategy,
    private readonly statusUpdate: StatusUpdateStrategy,
    private readonly cancelOrder: CancelOrderStrategy,
  ) {}

  createHandler(jobType: string) {
    const map = {
      [OrderJob.ProcessOrder]: this.processOrder,
      [OrderJob.UpdateStatus]: this.statusUpdate,
      [OrderJob.CancelOrder]: this.cancelOrder,
    };

    return map[jobType] || null;
  }
}
