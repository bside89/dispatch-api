import type { ICacheService } from '@/shared/modules/cache/interfaces/cache-service.interface';
import type { IOrderRepository } from '../interfaces/order-repository.interface';
import { OrderStatus } from '../enums/order-status.enum';
import { BaseJobStrategy } from '@/shared/strategies/base-job.strategy';
import { Order } from '../entities/order.entity';
import { LOCK_KEY } from '@/shared/constants/lock.key';
import { OrderJobPayload } from '@/shared/payloads/order-job.payload';
import { ORDER_STATUS_PRECONDITIONS } from '../constants/order-status-preconditions.constant';
import { DbGuardService } from '@/shared/modules/db-guard/db-guard.service';

export abstract class BaseOrderJobStrategy<
  T extends OrderJobPayload,
> extends BaseJobStrategy<T> {
  protected readonly VALID_PRECONDITIONS = ORDER_STATUS_PRECONDITIONS;

  constructor(
    jobName: string,
    protected readonly cacheService: ICacheService,
    protected readonly orderRepository: IOrderRepository,
    protected readonly guard: DbGuardService,
  ) {
    super(jobName);
  }

  /**
   * Updates the order with the provided data (with lock).
   * @param orderId The ID of the order to update.
   * @param updateData The data to update the order with.
   */
  async updateOrderWithLock(
    orderId: string,
    updateData: Partial<Order>,
  ): Promise<void> {
    return this.guard.lock(LOCK_KEY.ORDER.UPDATE(orderId), async () => {
      await this.orderRepository.update(orderId, updateData);
    });
  }

  protected async getAndValidate(
    orderId: string,
    newStatus: OrderStatus,
  ): Promise<Order | null> {
    const order = await this.orderRepository.findById(orderId, {
      relations: ['user'],
    });
    if (!order) {
      this.logger.error(`Order ${orderId} does not exist`);
      return null;
    }
    const preconditions = this.VALID_PRECONDITIONS[newStatus];
    if (!preconditions.includes(order.status)) {
      this.logger.error(
        `Order ${orderId} must be ${preconditions.join(' or ')} ` +
          `to proceed; current status: ${order.status}`,
      );
      return null;
    }
    return order;
  }
}
