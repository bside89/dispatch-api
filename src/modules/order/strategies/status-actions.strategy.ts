import { Logger } from '@nestjs/common';

export interface StatusAction {
  execute(orderId: string, logger: Logger): Promise<void>;
}

export abstract class BaseStatusAction implements StatusAction {
  protected async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  abstract execute(orderId: string, logger: Logger): Promise<void>;
}

export class ConfirmedStatusAction extends BaseStatusAction {
  async execute(orderId: string, logger: Logger): Promise<void> {
    await this.delay(1000);
    logger.debug(`Fulfillment triggered for order ${orderId}`);
  }
}

export class ShippedStatusAction extends BaseStatusAction {
  async execute(orderId: string, logger: Logger): Promise<void> {
    await this.delay(500);
    logger.debug(`Tracking info sent for order ${orderId}`);
  }
}

export class DeliveredStatusAction extends BaseStatusAction {
  async execute(orderId: string, logger: Logger): Promise<void> {
    await this.delay(200);
    logger.debug(`Feedback requested for order ${orderId}`);
  }
}

export class CancelledStatusAction extends BaseStatusAction {
  async execute(orderId: string, logger: Logger): Promise<void> {
    await this.delay(2000);
    logger.debug(`Refund processed for order ${orderId}`);
  }
}
