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

@Injectable()
export class CancelOrderJobStrategy extends BaseOrderJobStrategy<CancelOrderJobPayload> {
  constructor(
    private readonly outboxService: OutboxService,
    private readonly itemsService: ItemsService,
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

    const order = await this.getAndValidate(orderId, OrderStatus.CANCELLED);
    if (!order) return;

    this.logger.log(
      `Cancelling order, attempt ${job.attemptsMade + 1} of ${job.opts.attempts}`,
      { orderId },
    );

    await this.releaseInventory(job.data);

    await this.finish(job.data);
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

  private async releaseInventory(data: CancelOrderJobPayload) {
    const { orderId } = data;

    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['items'],
    });
    if (!order || order.items.length === 0) return;

    const itemIds = order.items.map((oi) => oi.itemId);
    const catalogItems = await this.itemsService.findManyByIds(itemIds);

    for (const orderItem of order.items) {
      const catalogItem = catalogItems.find((ci) => ci.id === orderItem.itemId);
      if (catalogItem) {
        await this.itemsService.incrementItemStock(catalogItem, orderItem.quantity);
      }
    }

    this.logger.log(`Inventory released for order`, { orderId });
  }

  private async finish(data: CancelOrderJobPayload) {
    const { orderId, userId, userName } = data;

    await this.updateOrderWithLock(orderId, { status: OrderStatus.CANCELLED });

    // Notify the user
    await this.outboxService.add(
      OutboxType.EVENTS_NOTIFY_USER,
      new NotifyUserJobPayload(
        userId,
        userName,
        `<To user ${userName}>: Your order with id ${orderId} has been cancelled.`,
      ),
    );

    this.logger.log(`Order moved to CANCELLED`, { orderId });
  }
}
