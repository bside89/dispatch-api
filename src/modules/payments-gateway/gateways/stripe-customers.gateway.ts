import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import Stripe from 'stripe';
import { BaseService } from '@/shared/services/base.service';
import {
  StripeCustomerResponse,
  DeletedStripeCustomer,
} from '../types/customer.types';
import { StripePaymentCustomer } from '../types/customer.types';
import { STRIPE_CLIENT } from '../constants/stripe-client.token';
import {
  StripeCreateCustomerDto,
  StripeUpdateCustomerDto,
} from '@/modules/payments-gateway/dto/stripe-customer.dto';
import { StripeCustomerMapper } from '../utils/stripe-customer-mapper';
import { template } from '@/shared/utils/functions.utils';
import { I18N_PAYMENTS } from '@/shared/constants/i18n';

@Injectable()
export class StripeCustomersGateway extends BaseService {
  constructor(@Inject(STRIPE_CLIENT) private readonly stripe: Stripe.Stripe) {
    super(StripeCustomersGateway.name);
  }

  async create(
    createCustomerDto: StripeCreateCustomerDto,
    idempotencyKey: string,
  ): Promise<StripePaymentCustomer> {
    const customer = await this.stripe.customers.create(
      StripeCustomerMapper.mapToStripeCustomerCreateParams(createCustomerDto),
      { idempotencyKey },
    );
    return StripeCustomerMapper.mapToPaymentCustomer(customer);
  }

  async list(): Promise<StripePaymentCustomer[]> {
    const customers = await this.stripe.customers.list();
    return StripeCustomerMapper.mapToPaymentCustomerList(customers.data);
  }

  async retrieve(customerId: string): Promise<StripePaymentCustomer> {
    const customer = await this.stripe.customers.retrieve(customerId);

    if (this.isDeletedCustomer(customer)) {
      throw new NotFoundException(
        template(I18N_PAYMENTS.ERRORS.CUSTOMER_DELETED, { customerId }),
      );
    }

    return StripeCustomerMapper.mapToPaymentCustomer(customer);
  }

  async update(
    customerId: string,
    updateParams: Partial<StripeUpdateCustomerDto>,
    idempotencyKey: string,
  ): Promise<StripePaymentCustomer> {
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

    return StripeCustomerMapper.mapToPaymentCustomer(customer);
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
  ): customer is DeletedStripeCustomer {
    return 'deleted' in customer && customer.deleted === true;
  }
}
