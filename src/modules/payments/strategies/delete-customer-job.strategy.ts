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

@Injectable()
export class DeleteCustomerJobStrategy extends BasePaymentJobStrategy<DeleteCustomerJobPayload> {
  constructor(
    protected readonly paymentsGatewayService: PaymentsGatewayService,
    protected readonly cacheService: CacheService,
    protected readonly orderRepository: OrderRepository,
    protected readonly userRepository: UserRepository,
    protected readonly dataSource: DataSource,
    protected readonly redlock: Redlock,
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
    const { userId, customerId } = job.data;

    this.logger.log(
      `Deleting customer, attempt ${job.attemptsMade + 1} of ${job.opts.attempts}`,
      { userId },
    );

    const user = await this.userRepository.findById(userId);
    if (user) {
      await this.updateUserWithLock(userId, {
        customerId: null,
      });
    }

    await this.deleteCustomer(job.data);

    this.logger.log(`Customer deleted successfully with ID: ${customerId}`, {
      userId,
    });
  }

  async executeAfterFail(
    job: Job<DeleteCustomerJobPayload>,
    error: Error,
  ): Promise<void> {
    this.logger.error(
      `[CRITICAL] Failed to delete customer for user after all retries: ${error.message}`,
      { userId: job.data.userId },
    );
  }

  private async deleteCustomer(data: DeleteCustomerJobPayload): Promise<void> {
    await this.paymentsGatewayService.customersDelete(data.customerId);
  }
}
