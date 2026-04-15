import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { UpdateCustomerJobPayload } from '@/shared/payloads/payment-job.payload';
import { BasePaymentJobStrategy } from './base-payment-job.strategy';
import { Job } from 'bullmq';
import Redlock from 'redlock';
import { DataSource } from 'typeorm';
import { UserRepository } from '@/modules/users/repositories/user.repository';
import { OrderRepository } from '@/modules/orders/repositories/order.repository';
import { CacheService } from '@/shared/modules/cache/cache.service';
import { plainToInstance } from 'class-transformer';
import { PaymentsGatewayService } from '@/modules/payments-gateway/payments-gateway.service';
import { CustomerResponseDto } from '@/modules/payments-gateway/dto/customer-response.dto';
import {
  UpdateCustomerAddressDto,
  UpdateCustomerDto,
} from '@/modules/payments-gateway/dto/update-customer.dto';
import { PAYMENT_KEY } from '@/shared/modules/cache/constants/payment.key';
import { template } from '@/shared/helpers/functions';
import { I18N_PAYMENTS } from '@/shared/constants/i18n/payments.tokens';

@Injectable()
export class UpdateCustomerJobStrategy extends BasePaymentJobStrategy<UpdateCustomerJobPayload> {
  constructor(
    paymentsGatewayService: PaymentsGatewayService,
    cacheService: CacheService,
    orderRepository: OrderRepository,
    userRepository: UserRepository,
    dataSource: DataSource,
    redlock: Redlock,
  ) {
    super(
      UpdateCustomerJobStrategy.name,
      paymentsGatewayService,
      cacheService,
      orderRepository,
      userRepository,
      dataSource,
      redlock,
    );
  }

  async execute(job: Job<UpdateCustomerJobPayload>): Promise<void> {
    const { userDto } = job.data;

    this.logger.log(
      `Updating customer, attempt ${job.attemptsMade + 1} of ${job.opts.attempts}`,
      { userId: userDto.id },
    );

    const customer = await this.updateCustomer(job.data);
    if (!customer || !customer.id) {
      throw new InternalServerErrorException(
        template(I18N_PAYMENTS.ERRORS.UPDATE_CUSTOMER_FAILED),
      );
    }

    this.logger.log(`Customer updated successfully with ID: ${customer.id}`, {
      userId: userDto.id,
    });
  }

  async executeAfterFail(
    job: Job<UpdateCustomerJobPayload>,
    error: Error,
  ): Promise<void> {
    const { userDto } = job.data;
    this.logger.error(
      `[CRITICAL] Failed to update customer for user after all retries: ${error.message}`,
      { userId: userDto.id },
    );
  }

  private async updateCustomer(
    data: UpdateCustomerJobPayload,
  ): Promise<CustomerResponseDto> {
    const { userDto } = data;

    const updateCustomerDto = this.toUpdateCustomerDto(data);
    const idempotencyKey = this.idempotencyKey(data.correlationId);

    return this.paymentsGatewayService.customersUpdate(
      userDto.customerId,
      updateCustomerDto,
      idempotencyKey,
    );
  }

  private toUpdateCustomerDto(data: UpdateCustomerJobPayload): UpdateCustomerDto {
    const { userDto } = data;

    const address = this.toUpdateCustomerAddressDto(userDto.address);
    return plainToInstance(UpdateCustomerDto, {
      email: userDto.email,
      name: userDto.name,
      address,
      metadata: { userId: userDto.id },
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

  idempotencyKey(id: string): string {
    return PAYMENT_KEY.IDEMPOTENCY('update-customer', id);
  }
}
