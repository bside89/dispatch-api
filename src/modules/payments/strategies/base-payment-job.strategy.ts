import type { ICacheService } from '@/shared/modules/cache/interfaces/cache-service.interface';
import { BaseJobStrategy } from '@/shared/strategies/base-job.strategy';
import { Order } from '@/modules/orders/entities/order.entity';
import { User } from '@/modules/users/entities/user.entity';
import { LOCK_KEY } from '@/shared/constants/lock.key';
import { PaymentJobPayload } from '@/shared/payloads/payments-job.payload';
import type { IOrderRepository } from '@/modules/orders/interfaces/order-repository.interface';
import type { IUserRepository } from '@/modules/users/interfaces/user-repository.interface';
import type { IPaymentGatewaysService } from '@/modules/payment-gateways/interfaces/payment-gateways-service.interface';
import { DbGuardService } from '@/shared/modules/db-guard/db-guard.service';

export abstract class BasePaymentJobStrategy<
  T extends PaymentJobPayload,
> extends BaseJobStrategy<T> {
  constructor(
    jobName: string,
    protected readonly paymentsGatewayService: IPaymentGatewaysService,
    protected readonly cacheService: ICacheService,
    protected readonly orderRepository: IOrderRepository,
    protected readonly userRepository: IUserRepository,
    protected readonly guard: DbGuardService,
  ) {
    super(jobName);
  }

  /**
   * Updates the order with the provided data (with lock).
   * @param orderId The ID of the order to update.
   * @param updateData The data to update the order with.
   */
  updateOrderWithLock(orderId: string, updateData: Partial<Order>): Promise<void> {
    return this.guard.lock(LOCK_KEY.ORDER.UPDATE(orderId), async () => {
      await this.orderRepository.update(orderId, updateData);
    });
  }

  /**
   * Updates the user with the provided data (with lock).
   * @param userId The ID of the user to update.
   * @param updateData The data to update the user with.
   */
  updateUserWithLock(userId: string, updateData: Partial<User>): Promise<void> {
    return this.guard.lock(LOCK_KEY.USER.UPDATE(userId), async () => {
      await this.userRepository.update(userId, updateData);
    });
  }

  abstract idempotencyKey(id: string): string;
}
