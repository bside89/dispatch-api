import { Logger } from '@nestjs/common';

export interface StatusNotificationStrategy {
  execute(orderId: string, logger: Logger): Promise<void>;
}

export abstract class BaseStatusNotificationStrategy implements StatusNotificationStrategy {
  protected async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  abstract execute(orderId: string, logger: Logger): Promise<void>;
}

export class ConfirmedStatusNotificationStrategy extends BaseStatusNotificationStrategy {
  async execute(orderId: string, logger: Logger): Promise<void> {
    await this.delay(1000);
    logger.log(`To customer: Order ${orderId} CONFIRMED`);
  }
}

export class ProcessingStatusNotificationStrategy extends BaseStatusNotificationStrategy {
  async execute(orderId: string, logger: Logger): Promise<void> {
    await this.delay(500);
    logger.log(`To customer: Order ${orderId} PROCESSING`);
  }
}

export class ShippedStatusNotificationStrategy extends BaseStatusNotificationStrategy {
  async execute(orderId: string, logger: Logger): Promise<void> {
    await this.delay(500);
    logger.log(`To customer: Order ${orderId} SHIPPED`);
  }
}

export class DeliveredStatusNotificationStrategy extends BaseStatusNotificationStrategy {
  async execute(orderId: string, logger: Logger): Promise<void> {
    await this.delay(200);
    logger.log(`To customer: Order ${orderId} DELIVERED`);
  }
}

export class CancelledStatusNotificationStrategy extends BaseStatusNotificationStrategy {
  async execute(orderId: string, logger: Logger): Promise<void> {
    await this.delay(2000);
    logger.log(`To customer: Order ${orderId} CANCELLED`);
  }
}

export class RefundedStatusNotificationStrategy extends BaseStatusNotificationStrategy {
  async execute(orderId: string, logger: Logger): Promise<void> {
    await this.delay(1500);
    logger.log(`To customer: Order ${orderId} REFUNDED`);
  }
}
