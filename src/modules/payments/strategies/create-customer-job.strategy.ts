import { Injectable, InternalServerErrorException } from '@nestjs/common';
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
import { PAYMENT_KEY } from '@/shared/modules/cache/constants/payment.key';
import { template } from '@/shared/helpers/functions';
import { I18N_PAYMENTS } from '@/shared/constants/i18n/payments.tokens';

@Injectable()
export class CreateCustomerJobStrategy extends BasePaymentJobStrategy<CreateCustomerJobPayload> {
  constructor(
    paymentsGatewayService: PaymentsGatewayService,
    cacheService: CacheService,
    orderRepository: OrderRepository,
    userRepository: UserRepository,
    dataSource: DataSource,
    redlock: Redlock,
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
    const { userDto } = job.data;

    this.logger.log(
      `Creating customer, attempt ${job.attemptsMade + 1} of ${job.opts.attempts}`,
      { userId: userDto.id },
    );

    const customer = await this.createCustomer(job.data);
    if (!customer || !customer.id) {
      throw new InternalServerErrorException(
        template(I18N_PAYMENTS.ERRORS.CREATE_CUSTOMER_FAILED),
      );
    }

    await this.updateUserWithLock(userDto.id, {
      customerId: customer.id,
    });

    this.logger.log(`Customer created successfully with ID: ${customer.id}`, {
      userId: userDto.id,
    });
  }

  async executeAfterFail(
    job: Job<CreateCustomerJobPayload>,
    error: Error,
  ): Promise<void> {
    this.logger.error(
      `[CRITICAL] Failed to create customer for user after all retries: ${error.message}`,
      { userId: job.data.userDto.id },
    );
  }

  private async createCustomer(
    data: CreateCustomerJobPayload,
  ): Promise<CustomerResponseDto> {
    const dto = this.toCreateCustomerDto(data);
    const idempotencyKey = this.idempotencyKey(data.correlationId);

    return this.paymentsGatewayService.customersCreate(dto, idempotencyKey);
  }

  private toCreateCustomerDto(data: CreateCustomerJobPayload): CreateCustomerDto {
    const address = this.toCreateCustomerAddressDto(data.userDto.address);
    return plainToInstance(CreateCustomerDto, {
      email: data.userDto.email,
      name: data.userDto.name,
      address,
      metadata: { userId: data.userDto.id },
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

  idempotencyKey(id: string): string {
    return PAYMENT_KEY.IDEMPOTENCY('create-customer', id);
  }
}
