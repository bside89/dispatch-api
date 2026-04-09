import { Injectable } from '@nestjs/common';
import { CreateCustomerJobPayload } from '@/shared/payloads/payment-job.payload';
import { BasePaymentJobStrategy } from './base-payment-job.strategy';
import { Job } from 'bullmq';
import { plainToInstance } from 'class-transformer';
import { BaseAddressDto } from '@/shared/dto/base-address.dto';
import { CacheService } from '@/shared/modules/cache/cache.service';
import { OrderRepository } from '@/modules/orders/repositories/order.repository';
import { UserRepository } from '@/modules/users/repositories/user.repository';
import { DataSource } from 'typeorm';
import Redlock from 'redlock';
import { PaymentsGatewayService } from '@/modules/payments-gateway/payments-gateway.service';
import { CustomerResponseDto } from '@/modules/payments-gateway/dto/customer-response.dto';
import {
  CreateCustomerAddressDto,
  CreateCustomerDto,
} from '@/modules/payments-gateway/dto/create-customer.dto';

@Injectable()
export class CreateCustomerJobStrategy extends BasePaymentJobStrategy<CreateCustomerJobPayload> {
  constructor(
    protected readonly paymentsGatewayService: PaymentsGatewayService,
    protected readonly cacheService: CacheService,
    protected readonly orderRepository: OrderRepository,
    protected readonly userRepository: UserRepository,
    protected readonly dataSource: DataSource,
    protected readonly redlock: Redlock,
  ) {
    super(
      CreateCustomerJobStrategy.name,
      paymentsGatewayService,
      cacheService,
      orderRepository,
      userRepository,
      dataSource,
      redlock,
    );
  }

  async execute(job: Job<CreateCustomerJobPayload>): Promise<void> {
    const { userId } = job.data;

    this.logger.log(
      `Creating customer, attempt ${job.attemptsMade + 1} of ${job.opts.attempts}`,
      { userId },
    );

    const customer = await this.createCustomer(job.data);
    if (!customer || !customer.id) {
      throw new Error('Failed to create customer: No customer ID returned');
    }

    await this.updateUserWithLock(userId, {
      customerId: customer.id,
    });

    this.logger.log(`Customer created successfully with ID: ${customer.id}`, {
      userId,
    });
  }

  async executeAfterFail(
    job: Job<CreateCustomerJobPayload>,
    error: Error,
  ): Promise<void> {
    this.logger.error(
      `[CRITICAL] Failed to create customer for user after all retries: ${error.message}`,
      { userId: job.data.userId },
    );
  }

  private async createCustomer(
    data: CreateCustomerJobPayload,
  ): Promise<CustomerResponseDto> {
    const createCustomerDto = this.toCreateCustomerDto(data);
    return this.paymentsGatewayService.customersCreate(createCustomerDto);
  }

  private toCreateCustomerDto(data: CreateCustomerJobPayload): CreateCustomerDto {
    const address = this.toCreateCustomerAddressDto(data.address);

    return plainToInstance(CreateCustomerDto, {
      email: data.email,
      name: data.userName,
      address,
    });
  }

  private toCreateCustomerAddressDto(
    address?: BaseAddressDto,
  ): CreateCustomerAddressDto | undefined {
    if (!address) {
      return undefined;
    }

    return plainToInstance(CreateCustomerAddressDto, address);
  }
}
