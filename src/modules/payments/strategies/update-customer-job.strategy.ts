import { Injectable } from '@nestjs/common';
import { UpdateCustomerJobPayload } from '@/shared/payloads/payment-job.payload';
import { BasePaymentJobStrategy } from './base-payment-job.strategy';
import { Job } from 'bullmq';
import Redlock from 'redlock';
import { DataSource } from 'typeorm';
import { UserRepository } from '@/modules/users/repositories/user.repository';
import { OrderRepository } from '@/modules/orders/repositories/order.repository';
import { CacheService } from '@/shared/modules/cache/cache.service';
import { PaymentsService } from '../payments.service';
import {
  UpdateCustomerAddressDto,
  UpdateCustomerDto,
} from '../dto/update-customer.dto';
import { plainToInstance } from 'class-transformer';
import { CustomerResponseDto } from '../dto/customer-response.dto';

@Injectable()
export class UpdateCustomerJobStrategy extends BasePaymentJobStrategy<UpdateCustomerJobPayload> {
  constructor(
    protected readonly paymentsService: PaymentsService,
    protected readonly cacheService: CacheService,
    protected readonly orderRepository: OrderRepository,
    protected readonly userRepository: UserRepository,
    protected readonly dataSource: DataSource,
    protected readonly redlock: Redlock,
  ) {
    super(
      UpdateCustomerJobStrategy.name,
      paymentsService,
      cacheService,
      orderRepository,
      userRepository,
      dataSource,
      redlock,
    );
  }

  async execute(job: Job<UpdateCustomerJobPayload>): Promise<void> {
    const { userId, customerId } = job.data;

    this.logger.log(
      `Updating customer, attempt ${job.attemptsMade + 1} of ${job.opts.attempts}`,
      { userId },
    );

    const customer = await this.updateCustomer(job.data);
    if (!customer || !customer.id) {
      throw new Error('Failed to update customer: No customer ID returned');
    }

    this.logger.log(`Customer updated successfully with ID: ${customerId}`, {
      userId,
    });
  }

  async executeAfterFail(
    job: Job<UpdateCustomerJobPayload>,
    error: Error,
  ): Promise<void> {
    this.logger.error(
      `[CRITICAL] Failed to update customer for user after all retries: ${error.message}`,
      { userId: job.data.userId },
    );
  }

  private async updateCustomer(
    data: UpdateCustomerJobPayload,
  ): Promise<CustomerResponseDto> {
    const updateCustomerDto = this.toUpdateCustomerDto(data);
    return this.paymentsService.customersUpdate(data.customerId, updateCustomerDto);
  }

  private toUpdateCustomerDto(data: UpdateCustomerJobPayload): UpdateCustomerDto {
    const address = this.toUpdateCustomerAddressDto(data.address);

    return plainToInstance(UpdateCustomerDto, {
      email: data.email,
      name: data.userName,
      address,
    });
  }

  private toUpdateCustomerAddressDto(
    address?: UpdateCustomerAddressDto,
  ): UpdateCustomerAddressDto | undefined {
    if (!address) {
      return undefined;
    }

    return plainToInstance(UpdateCustomerAddressDto, address);
  }
}
