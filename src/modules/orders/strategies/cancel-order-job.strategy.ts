import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { OrderStatus } from '../enums/order-status.enum';
import { CancelOrderJobPayload } from '../../../shared/payloads/order-job.payload';
import { NotifyUserJobPayload } from '../../../shared/payloads/event-job.payload';
import { Transactional } from '@/shared/decorators/transactional.decorator';
import { OutboxType } from '@/shared/modules/outbox/enums/outbox-type.enum';
import { CacheService } from '../../../shared/modules/cache/cache.service';
import { OutboxService } from '@/shared/modules/outbox/outbox.service';
import { OrderRepository } from '../repositories/order.repository';
import { DataSource } from 'typeorm';
import { BaseOrderJobStrategy } from './base-order-job.strategy';
import Redlock from 'redlock';
import { ItemsService } from '../../items/items.service';
import { OrderMessageFactory } from '../factories/order-message.factory';
import { Order } from '../entities/order.entity';

@Injectable()
export class CancelOrderJobStrategy extends BaseOrderJobStrategy<CancelOrderJobPayload> {
  constructor(
    private readonly outboxService: OutboxService,
    private readonly itemsService: ItemsService,
    private readonly messages: OrderMessageFactory,
    cacheService: CacheService,
    orderRepository: OrderRepository,
    dataSource: DataSource,
    redlock: Redlock,
  ) {
    super(
      CancelOrderJobStrategy.name,
      cacheService,
      orderRepository,
      dataSource,
      redlock,
    );
  }

  @Transactional()
  async execute(job: Job<CancelOrderJobPayload>): Promise<void> {
    const { orderId } = job.data;

    const order = await this.getAndValidate(orderId, OrderStatus.CANCELED);
    if (!order) return;

    this.logger.log(
      `Cancelling order, attempt ${job.attemptsMade + 1} of ${job.opts.attempts}`,
      { orderId: order.id },
    );

    await this.releaseInventory(order);

    await this.finish(order);
  }

  @Transactional()
  async executeAfterFail(
    job: Job<CancelOrderJobPayload>,
    error: Error,
  ): Promise<void> {
    const { orderId } = job.data;

    this.logger.error(
      `[CRITICAL] Failed to cancel order after all retries: ${error.message}`,
      { orderId },
    );
  }

  private async releaseInventory(order: Order) {
    const itemIds = order.items.map((oi) => oi.itemId);
    const catalogItems = await this.itemsService.findManyByIds(itemIds);

    for (const orderItem of order.items) {
      const catalogItem = catalogItems.find((ci) => ci.id === orderItem.itemId);
      if (catalogItem) {
        await this.itemsService.incrementItemStock(catalogItem, orderItem.quantity);
      }
    }

    this.logger.log(`Inventory released for order`, { orderId: order.id });
  }

  private async finish(order: Order) {
    await this.updateOrderWithLock(order.id, { status: OrderStatus.CANCELED });

    // Notify the user
    const user = order.user;
    const message = await this.messages.notifications.orderCanceled(user.language);
    await this.outboxService.add(
      OutboxType.EVENTS_NOTIFY_USER,
      new NotifyUserJobPayload(user.id, message),
    );

    this.logger.log(`Order moved to CANCELED`, { orderId: order.id });
  }
}
