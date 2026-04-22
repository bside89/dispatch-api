import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import Stripe from 'stripe';
import {
  StripeCustomerResponse,
  StripeDeletedCustomer,
} from '../types/stripe-customer.type';
import { STRIPE_CLIENT } from '../../../constants/stripe-client.token';
import {
  StripeCreateCustomerDto,
  StripeUpdateCustomerDto,
} from '../dto/stripe-customer.dto';
import { StripeCustomerMapper } from '../helpers/stripe-customer-mapper.helper';
import { template } from '@/shared/utils/functions.utils';
import { I18N_PAYMENTS } from '@/shared/constants/i18n';
import { BaseStripeAdapter } from './base-stripe.adapter';
import { GatewayCustomerResponseDto } from '@/modules/payment-gateways/dto/gateway-customer-response.dto';
import { EntityMapper } from '@/shared/utils/entity-mapper.utils';

@Injectable()
export class StripeCustomersAdapter extends BaseStripeAdapter {
  constructor(@Inject(STRIPE_CLIENT) stripe: Stripe.Stripe) {
    super(stripe);
  }

  async create(
    createCustomerDto: StripeCreateCustomerDto,
    idempotencyKey: string,
  ): Promise<GatewayCustomerResponseDto> {
    const customer = await this.stripe.customers.create(
      StripeCustomerMapper.mapToStripeCustomerCreateParams(createCustomerDto),
      { idempotencyKey },
    );
    const paymentCustomer = StripeCustomerMapper.mapToPaymentCustomer(customer);
    return EntityMapper.map(paymentCustomer, GatewayCustomerResponseDto);
  }

  async list(): Promise<GatewayCustomerResponseDto[]> {
    const customers = await this.stripe.customers.list();
    const paymentCustomers = StripeCustomerMapper.mapToPaymentCustomerList(
      customers.data,
    );
    return paymentCustomers.map((paymentCustomer) =>
      EntityMapper.map(paymentCustomer, GatewayCustomerResponseDto),
    );
  }

  async retrieve(customerId: string): Promise<GatewayCustomerResponseDto> {
    const customer = await this.stripe.customers.retrieve(customerId);

    if (this.isDeletedCustomer(customer)) {
      throw new NotFoundException(
        template(I18N_PAYMENTS.ERRORS.CUSTOMER_DELETED, { customerId }),
      );
    }

    return EntityMapper.map(
      StripeCustomerMapper.mapToPaymentCustomer(customer),
      GatewayCustomerResponseDto,
    );
  }

  async update(
    customerId: string,
    updateParams: Partial<StripeUpdateCustomerDto>,
    idempotencyKey: string,
  ): Promise<GatewayCustomerResponseDto> {
    const customer = await this.stripe.customers.update(
      customerId,
      StripeCustomerMapper.mapToStripeCustomerCreateParams(
        updateParams as StripeCreateCustomerDto,
      ),
      { idempotencyKey },
    );

    if (this.isDeletedCustomer(customer)) {
      throw new NotFoundException(
        template(I18N_PAYMENTS.ERRORS.CUSTOMER_DELETED, { customerId }),
      );
    }

    return EntityMapper.map(
      StripeCustomerMapper.mapToPaymentCustomer(customer),
      GatewayCustomerResponseDto,
    );
  }

  async delete(customerId: string, idempotencyKey: string): Promise<void> {
    const result = await this.stripe.customers.del(customerId, { idempotencyKey });
    if (!result.deleted) {
      throw new NotFoundException(
        template(I18N_PAYMENTS.ERRORS.CUSTOMER_NOT_FOUND, { customerId }),
      );
    }
  }

  private isDeletedCustomer(
    customer: StripeCustomerResponse,
  ): customer is StripeDeletedCustomer {
    return 'deleted' in customer && customer.deleted === true;
  }
}
