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
    logger.log(`Order ${orderId} CONFIRMED`);
  }
}

export class ProcessingStatusAction extends BaseStatusAction {
  async execute(orderId: string, logger: Logger): Promise<void> {
    await this.delay(500);
    logger.log(`Order ${orderId} PROCESSING`);
  }
}

export class ShippedStatusAction extends BaseStatusAction {
  async execute(orderId: string, logger: Logger): Promise<void> {
    await this.delay(500);
    logger.log(`Order ${orderId} SHIPPED`);
  }
}

export class DeliveredStatusAction extends BaseStatusAction {
  async execute(orderId: string, logger: Logger): Promise<void> {
    await this.delay(200);
    logger.log(`Order ${orderId} DELIVERED`);
  }
}

export class CancelledStatusAction extends BaseStatusAction {
  async execute(orderId: string, logger: Logger): Promise<void> {
    await this.delay(2000);
    logger.log(`Order ${orderId} CANCELLED`);
  }
}

export class RefundedStatusAction extends BaseStatusAction {
  async execute(orderId: string, logger: Logger): Promise<void> {
    await this.delay(1500);
    logger.log(`Order ${orderId} REFUNDED`);
  }
}
