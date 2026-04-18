import type { ICacheService } from '@/shared/modules/cache/interfaces/cache-service.interface';
import { BaseJobStrategy } from '@/shared/strategies/base-job.strategy';
import Redlock from 'redlock';
import { DataSource } from 'typeorm';
import { ORDER_KEY } from '@/shared/modules/cache/constants/order.key';
import { Order } from '@/modules/orders/entities/order.entity';
import { UseLock } from '@/shared/decorators/lock.decorator';
import { User } from '@/modules/users/entities/user.entity';
import { USER_KEY } from '@/shared/modules/cache/constants/user.key';
import { LOCK_PREFIX } from '@/shared/constants/lock-prefix.constant';
import { PaymentJobPayload } from '@/shared/payloads/payment-job.payload';
import type { IOrderRepository } from '@/modules/orders/interfaces/order-repository.interface';
import type { IUserRepository } from '@/modules/users/interfaces/user-repository.interface';
import type { IPaymentsGatewayService } from '@/modules/payments-gateway/interfaces/payments-gateway-service.interface';

export abstract class BasePaymentJobStrategy<
  T extends PaymentJobPayload,
> extends BaseJobStrategy<T> {
  constructor(
    jobName: string,
    protected readonly paymentsGatewayService: IPaymentsGatewayService,
    protected readonly cacheService: ICacheService,
    protected readonly orderRepository: IOrderRepository,
    protected readonly userRepository: IUserRepository,
    protected readonly dataSource: DataSource,
    protected readonly redlock: Redlock,
  ) {
    super(jobName);
  }

  /**
   * Updates the order with the provided data (with lock).
   * @param orderId The ID of the order to update.
   * @param updateData The data to update the order with.
   */
  @UseLock({ prefix: LOCK_PREFIX.ORDER.UPDATE, key: ([orderId]) => orderId })
  async updateOrderWithLock(
    orderId: string,
    updateData: Partial<Order>,
  ): Promise<void> {
    await this.orderRepository.update(orderId, updateData);

    await this.cacheService.deleteBulk({
      keys: [ORDER_KEY.CACHE_FIND_ONE(orderId)],
      patterns: [ORDER_KEY.CACHE_FIND_ALL_PATTERN()],
    });
  }

  /**
   * Updates the user with the provided data (with lock).
   * @param userId The ID of the user to update.
   * @param updateData The data to update the user with.
   */
  @UseLock({ prefix: LOCK_PREFIX.USER.UPDATE, key: ([userId]) => userId })
  async updateUserWithLock(
    userId: string,
    updateData: Partial<User>,
  ): Promise<void> {
    await this.userRepository.update(userId, updateData);

    await this.cacheService.deleteBulk({
      keys: [USER_KEY.CACHE_FIND_ONE(userId)],
      patterns: [USER_KEY.CACHE_FIND_ALL_PATTERN()],
    });
  }

  abstract idempotencyKey(id: string): string;
}
