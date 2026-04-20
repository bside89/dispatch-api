import { Injectable, Inject } from '@nestjs/common';
import { DeleteCustomerJobPayload } from '@/shared/payloads/payments-job.payload';
import { BasePaymentJobStrategy } from './base-payment-job.strategy';
import { Job } from 'bullmq';
import { PAYMENTS_GATEWAY_SERVICE } from '@/modules/payments-gateway/constants/payments-gateway.token';
import type { IPaymentsGatewayService } from '@/modules/payments-gateway/interfaces/payments-gateway-service.interface';
import { ORDER_REPOSITORY } from '@/modules/orders/constants/orders.token';
import type { IOrderRepository } from '@/modules/orders/interfaces/order-repository.interface';
import { USER_REPOSITORY } from '@/modules/users/constants/users.token';
import type { IUserRepository } from '@/modules/users/interfaces/user-repository.interface';
import { CACHE_SERVICE } from '@/shared/modules/cache/constants/cache.token';
import type { ICacheService } from '@/shared/modules/cache/interfaces/cache-service.interface';
import { PAYMENT_KEY } from '@/shared/modules/cache/constants/payment.key';
import { DbGuardService } from '@/shared/modules/db-guard/db-guard.service';

@Injectable()
export class DeleteCustomerJobStrategy extends BasePaymentJobStrategy<DeleteCustomerJobPayload> {
  constructor(
    @Inject(PAYMENTS_GATEWAY_SERVICE)
    paymentsGatewayService: IPaymentsGatewayService,
    @Inject(CACHE_SERVICE) cacheService: ICacheService,
    @Inject(ORDER_REPOSITORY) orderRepository: IOrderRepository,
    @Inject(USER_REPOSITORY) userRepository: IUserRepository,
    guard: DbGuardService,
  ) {
    super(
      DeleteCustomerJobStrategy.name,
      paymentsGatewayService,
      cacheService,
      orderRepository,
      userRepository,
      guard,
    );
  }

  async execute(job: Job<DeleteCustomerJobPayload>): Promise<void> {
    const { userDto } = job.data;

    this.logger.log(
      `Deleting customer, attempt ${job.attemptsMade + 1} of ${job.opts.attempts}`,
      { userId: userDto.id },
    );

    const user = await this.userRepository.findById(userDto.id);
    if (user) {
      await this.updateUserWithLock(userDto.id, {
        customerId: null,
      });
    }
    await this.deleteCustomer(job.data);

    this.logger.log(`Customer deleted successfully with ID: ${userDto.id}`, {
      userId: userDto.id,
    });
  }

  async executeAfterFail(
    job: Job<DeleteCustomerJobPayload>,
    error: Error,
  ): Promise<void> {
    const { userDto } = job.data;
    this.logger.error(
      `[CRITICAL] Failed to delete customer for user after all retries: ${error.message}`,
      { userId: userDto.id },
    );
  }

  private async deleteCustomer(data: DeleteCustomerJobPayload): Promise<void> {
    const { userDto } = data;
    const idempotencyKey = this.idempotencyKey(data.correlationId);
    await this.paymentsGatewayService.customersDelete(
      userDto.customerId,
      idempotencyKey,
    );
  }

  idempotencyKey(id: string): string {
    return PAYMENT_KEY.IDEMPOTENCY('delete-customer', id);
  }
}
