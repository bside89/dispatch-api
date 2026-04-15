import { Injectable } from '@nestjs/common';
import { DeleteCustomerJobPayload } from '@/shared/payloads/payment-job.payload';
import { BasePaymentJobStrategy } from './base-payment-job.strategy';
import { Job } from 'bullmq';
import Redlock from 'redlock';
import { DataSource } from 'typeorm';
import { UserRepository } from '@/modules/users/repositories/user.repository';
import { OrderRepository } from '@/modules/orders/repositories/order.repository';
import { CacheService } from '@/shared/modules/cache/cache.service';
import { PaymentsGatewayService } from '@/modules/payments-gateway/payments-gateway.service';
import { PAYMENT_KEY } from '@/shared/modules/cache/constants/payment.key';

@Injectable()
export class DeleteCustomerJobStrategy extends BasePaymentJobStrategy<DeleteCustomerJobPayload> {
  constructor(
    paymentsGatewayService: PaymentsGatewayService,
    cacheService: CacheService,
    orderRepository: OrderRepository,
    userRepository: UserRepository,
    dataSource: DataSource,
    redlock: Redlock,
  ) {
    super(
      DeleteCustomerJobStrategy.name,
      paymentsGatewayService,
      cacheService,
      orderRepository,
      userRepository,
      dataSource,
      redlock,
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
