import { Injectable, InternalServerErrorException, Inject } from '@nestjs/common';
import { CreateCustomerJobPayload } from '@/shared/payloads/payments-job.payload';
import { BasePaymentJobStrategy } from './base-payment-job.strategy';
import { Job } from 'bullmq';
import { CACHE_SERVICE } from '@/shared/modules/cache/constants/cache.token';
import type { ICacheService } from '@/shared/modules/cache/interfaces/cache-service.interface';
import { PAYMENTS_GATEWAY_SERVICE } from '@/modules/payment-gateways/constants/payments-gateway.token';
import type { IPaymentGatewaysService } from '@/modules/payment-gateways/interfaces/payment-gateways-service.interface';
import { ORDER_REPOSITORY } from '@/modules/orders/constants/orders.token';
import type { IOrderRepository } from '@/modules/orders/interfaces/order-repository.interface';
import { USER_REPOSITORY } from '@/modules/users/constants/users.token';
import type { IUserRepository } from '@/modules/users/interfaces/user-repository.interface';
import { GatewayCustomerResponseDto } from '@/modules/payment-gateways/dto/gateway-customer-response.dto';
import {
  GatewayCreateCustomerDto,
  GatewayAddressDto,
} from '@/modules/payment-gateways/dto/gateway-customer.dto';
import { BaseAddressDto } from '@/shared/dto/base-address.dto';
import { PAYMENT_KEY } from '@/shared/modules/cache/constants/payment.key';
import { template } from '@/shared/utils/functions.utils';
import { I18N_PAYMENTS } from '@/shared/constants/i18n';
import { DbGuardService } from '@/shared/modules/db-guard/db-guard.service';

@Injectable()
export class CreateCustomerJobStrategy extends BasePaymentJobStrategy<CreateCustomerJobPayload> {
  constructor(
    @Inject(PAYMENTS_GATEWAY_SERVICE)
    paymentsGatewayService: IPaymentGatewaysService,
    @Inject(CACHE_SERVICE) cacheService: ICacheService,
    @Inject(ORDER_REPOSITORY) orderRepository: IOrderRepository,
    @Inject(USER_REPOSITORY) userRepository: IUserRepository,
    guard: DbGuardService,
  ) {
    super(
      CreateCustomerJobStrategy.name,
      paymentsGatewayService,
      cacheService,
      orderRepository,
      userRepository,
      guard,
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
  ): Promise<GatewayCustomerResponseDto> {
    const dto = this.toCreateCustomerDto(data);
    const idempotencyKey = this.idempotencyKey(data.userDto.id);

    return this.paymentsGatewayService.customers.create(dto, idempotencyKey);
  }

  private toCreateCustomerDto(
    data: CreateCustomerJobPayload,
  ): GatewayCreateCustomerDto {
    const address = this.toGatewayAddressDto(data.userDto.address);
    const dto = new GatewayCreateCustomerDto();
    dto.email = data.userDto.email;
    dto.name = data.userDto.name;
    dto.address = address;
    dto.metadata = { userId: data.userDto.id };
    return dto;
  }

  private toGatewayAddressDto(
    address?: BaseAddressDto,
  ): GatewayAddressDto | undefined {
    if (!address) {
      return undefined;
    }
    const dto = new GatewayAddressDto();
    Object.assign(dto, address);
    return dto;
  }

  idempotencyKey(id: string): string {
    return PAYMENT_KEY.IDEMPOTENCY('create-customer', id);
  }
}
